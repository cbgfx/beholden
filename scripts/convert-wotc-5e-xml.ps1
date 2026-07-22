param(
  [string]$InputPath = "compendium/WotC_5e_only.xml",
  [string]$OutputPath = "compendium/WotC_5e_only.json"
)

$ErrorActionPreference = "Stop"

function Text-Of([System.Xml.XmlNode]$Node, [string]$XPath) {
  $match = $Node.SelectSingleNode($XPath)
  if ($null -eq $match) { return "" }
  return $match.InnerText.Trim()
}

function Slug([string]$Value) {
  $slug = $Value.ToLowerInvariant() -replace "[^a-z0-9]+", "_"
  return $slug.Trim("_")
}

function Split-List([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value) -or $Value -match "^(none|-)$") { return @() }
  return @($Value -split "\s*,\s*" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Clean-Text([string]$Value) {
  return (($Value -replace "(?ms)\r?\n\s*Source:\s*.+?\s*$", "").Trim())
}

function Source-From([string[]]$Values) {
  foreach ($value in $Values) {
    if ($value -match "(?ms)\r?\n\s*Source:\s*(.+?)\s*$") { return $Matches[1].Trim() }
  }
  return ""
}

function Unique-Id([string]$Prefix, [string]$Name, [hashtable]$Seen) {
  $base = $Prefix + (Slug $Name)
  $id = $base
  $suffix = 2
  while ($Seen.ContainsKey($id)) { $id = "${base}_$suffix"; $suffix++ }
  $Seen[$id] = $true
  return $id
}

function Ability-Code([string]$Value) {
  switch -Regex ($Value.Trim().ToLowerInvariant()) {
    "^str" { return "str" }
    "^dex" { return "dex" }
    "^con" { return "con" }
    "^int" { return "int" }
    "^wis" { return "wis" }
    "^cha" { return "cha" }
    default { return "" }
  }
}

$raw = [IO.File]::ReadAllText((Resolve-Path $InputPath))
# The archived file has one obsolete closing tag after its actual document root.
$raw = $raw -replace "</compendium>\s*</xml>\s*$", "</compendium>"
[xml]$document = $raw
$root = $document.DocumentElement

$classIds = @{}
$classes = @($root.SelectNodes("./class") | ForEach-Object {
  $node = $_
  $name = Text-Of $node "./name"
  $allText = @($node.SelectNodes(".//text") | ForEach-Object { $_.InnerText })
  $source = Source-From $allText
  [object[]]$proficiency = @(Split-List (Text-Of $node "./proficiency"))
  $saves = @($proficiency | Select-Object -First 2 | ForEach-Object { Ability-Code $_ } | Where-Object { $_ })
  $skills = @($proficiency | Select-Object -Skip 2)

  $levelRows = @()
  foreach ($group in @($node.SelectNodes("./autolevel") | Group-Object { [int]$_.GetAttribute("level") } | Sort-Object { [int]$_.Name })) {
    $level = [int]$group.Name
    $features = @()
    $featureIds = @{}
    foreach ($levelNode in $group.Group) {
      foreach ($feature in @($levelNode.SelectNodes("./feature"))) {
        $featureName = Text-Of $feature "./name"
        $featureText = Text-Of $feature "./text"
        $featureSource = Source-From @($featureText)
        $entry = [ordered]@{
          id = Unique-Id "cf_$(Slug $name)_${level}_" $featureName $featureIds
          name = $featureName
          description = Clean-Text $featureText
        }
        if ($featureSource) { $entry.source = $featureSource }
        $entry.resolution = "manual"
        $features += $entry
      }
    }
    $row = [ordered]@{ level = $level }
    if (@($group.Group | Where-Object { $_.GetAttribute("scoreImprovement") -eq "YES" }).Count -gt 0) {
      $row.abilityScoreImprovement = $true
    }
    if ($features.Count -gt 0) { $row.features = $features }
    $levelRows += $row
  }

  $descriptions = @($node.SelectNodes("./trait/text") | ForEach-Object { Clean-Text $_.InnerText } | Where-Object { $_ })
  $entry = [ordered]@{
    id = Unique-Id "c_" $name $classIds
    ruleset = "5e"
    name = $name
    description = if ($descriptions.Count) { $descriptions[0] } else { "" }
  }
  if ($source) { $entry.source = $source }
  if ($descriptions.Count -gt 1) { $entry.descriptions = $descriptions }
  $hitDie = Text-Of $node "./hd"
  if ($hitDie -match "^\d+$") { $entry.hitDie = [int]$hitDie }
  $entry.proficiencies = [ordered]@{
    savingThrows = $saves
    skills = [ordered]@{ choose = [int](Text-Of $node "./numSkills"); from = $skills }
    armor = @(Split-List (Text-Of $node "./armor"))
    weapons = @(Split-List (Text-Of $node "./weapons"))
  }
  [object[]]$tools = @(Split-List (Text-Of $node "./tools"))
  if ($tools.Count) { $entry.proficiencies.tools = [ordered]@{ notes = @($tools) } }
  $spellAbility = Ability-Code (Text-Of $node "./spellAbility")
  if ($spellAbility) { $entry.spellcasting = [ordered]@{ ability = $spellAbility } }
  $entry.levels = $levelRows
  $entry
})

# PHB races/subraces, plus legacy forms of species present in the current 5.5e corpus.
# Deliberately excludes every named variant, legacy duplicate, dragonmark, and setting lineage.
$keptRaceNames = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
@(
  "Dragonborn", "Dwarf, Hill", "Dwarf, Mountain", "Elf, Drow / Dark", "Elf, High", "Elf, Wood",
  "Gnome, Forest", "Gnome, Rock", "Half-Elf", "Half-Orc", "Halfling, Lightfoot", "Halfling, Stout",
  "Human", "Tiefling", "Aasimar", "Goliath", "Orc", "Warforged"
) | ForEach-Object { [void]$keptRaceNames.Add($_) }

$speciesIds = @{}
$species = @($root.SelectNodes("./race") | Where-Object {
  $keptRaceNames.Contains((Text-Of $_ "./name"))
} | ForEach-Object {
  $node = $_
  $name = Text-Of $node "./name"
  $texts = @($node.SelectNodes("./trait/text") | ForEach-Object { $_.InnerText })
  $entry = [ordered]@{
    id = Unique-Id "r_" $name $speciesIds
    ruleset = "5e"
    name = $name
    speed = 0
    traits = @()
  }
  $source = Source-From $texts
  if ($source) { $entry.source = $source }
  $size = Text-Of $node "./size"
  if ($size -match "[TSMLHG]") { $entry.size = $Matches[0] }
  $speed = Text-Of $node "./speed"
  if ($speed -match "\d+") { $entry.speed = [int]$Matches[0] }
  $spellAbility = Ability-Code (Text-Of $node "./spellAbility")
  if ($spellAbility) { $entry.spellcastingAbility = $spellAbility }

  $traitIds = @{}
  foreach ($trait in @($node.SelectNodes("./trait"))) {
    $traitName = Text-Of $trait "./name"
    $traitText = Text-Of $trait "./text"
    $entry.traits += [ordered]@{
      id = Unique-Id "rt_$(Slug $name)_" $traitName $traitIds
      name = $traitName
      description = Clean-Text $traitText
      resolution = "manual"
    }
  }
  $legacyEffects = @()
  foreach ($field in @("ability", "proficiency", "armor", "weapons", "tools", "resist", "immune", "conditionResist", "conditionImmune", "spells", "speedOther")) {
    foreach ($fact in @($node.SelectNodes("./$field"))) {
      if ($fact.InnerText.Trim()) {
        $legacyEffects += [ordered]@{ kind = "source_modifier"; category = $field; value = $fact.InnerText.Trim() }
      }
    }
  }
  if ($legacyEffects.Count) {
    $entry.traits += [ordered]@{
      id = Unique-Id "rt_$(Slug $name)_" "Legacy source mechanics" $traitIds
      name = "Legacy source mechanics"
      description = "Structured source fields retained from the legacy 5e compendium."
      effects = $legacyEffects
      resolution = "mixed"
      resolutionNotes = @("Source facts are retained verbatim; unsupported legacy syntax requires review.")
    }
  }
  $entry
})

$backgroundIds = @{}
$backgrounds = @($root.SelectNodes("./background") | ForEach-Object {
  $node = $_
  $name = Text-Of $node "./name"
  $traits = @($node.SelectNodes("./trait"))
  $texts = @($traits | ForEach-Object { Text-Of $_ "./text" })
  $descriptionNode = $node.SelectSingleNode("./trait[name='Description']")
  $entry = [ordered]@{
    id = Unique-Id "bg_" $name $backgroundIds
    ruleset = "5e"
    name = $name
    description = if ($descriptionNode) { Clean-Text (Text-Of $descriptionNode "./text") } else { "" }
    proficiencies = [ordered]@{}
  }
  $source = Source-From $texts
  if ($source) { $entry.source = $source }
  [object[]]$skills = @(Split-List (Text-Of $node "./proficiency"))
  if ($skills.Count) { $entry.proficiencies.skills = @($skills) }
  $tools = Text-Of $node "./tools"
  if ($tools) {
    if ($tools -match "(?i)(any|choice|choose|your choice)") { $entry.proficiencies.tools = [ordered]@{ choose = 1 } }
    else { [object[]]$fixedTools = @(Split-List $tools); $entry.proficiencies.tools = @($fixedTools) }
  }
  $languages = Text-Of $node "./languages"
  if ($languages) {
    if ($languages -match "(?i)(\d+|one|two).*(choice|language)") {
      $count = if ($languages -match "\d+") { [int]$Matches[0] } elseif ($languages -match "(?i)two") { 2 } else { 1 }
      $entry.proficiencies.languages = [ordered]@{ choose = $count }
    } else { [object[]]$fixedLanguages = @(Split-List $languages); $entry.proficiencies.languages = @($fixedLanguages) }
  }
  $traitIds = @{}
  $otherTraits = @($traits | Where-Object { (Text-Of $_ "./name") -ne "Description" } | ForEach-Object {
    $traitName = Text-Of $_ "./name"
    [ordered]@{
      id = Unique-Id "bt_$(Slug $name)_" $traitName $traitIds
      name = $traitName
      description = Clean-Text (Text-Of $_ "./text")
      resolution = "manual"
    }
  })
  if ($otherTraits.Count) { $entry.traits = $otherTraits }
  $entry
})

$featIds = @{}
$feats = @($root.SelectNodes("./feat") | ForEach-Object {
  $node = $_
  $name = Text-Of $node "./name"
  $text = Text-Of $node "./text"
  $entry = [ordered]@{
    id = Unique-Id "f_" $name $featIds
    ruleset = "5e"
    name = $name
    description = Clean-Text $text
    resolution = "manual"
  }
  $source = Source-From @($text)
  if ($source) { $entry.source = $source }
  $mechanics = [ordered]@{}
  $prerequisite = Text-Of $node "./prerequisite"
  if ($prerequisite) { $mechanics.prerequisite = $prerequisite }
  $effects = @()
  foreach ($modifier in @($node.SelectNodes("./modifier"))) {
    $effects += [ordered]@{ kind = "source_modifier"; category = $modifier.GetAttribute("category"); value = $modifier.InnerText.Trim() }
  }
  foreach ($special in @($node.SelectNodes("./special"))) {
    $effects += [ordered]@{ kind = "source_special"; value = $special.InnerText.Trim() }
  }
  foreach ($proficiency in @($node.SelectNodes("./proficiency|./armor|./weapons|./languages"))) {
    $effects += [ordered]@{ kind = "source_proficiency"; value = "$($proficiency.Name): $($proficiency.InnerText.Trim())" }
  }
  if ($effects.Count) { $mechanics.grants = [ordered]@{ effects = $effects } }
  $rolls = @($node.SelectNodes("./roll") | ForEach-Object {
    $roll = [ordered]@{ formula = $_.InnerText.Trim() }
    if ($_.GetAttribute("description")) { $roll.description = $_.GetAttribute("description") }
    $roll
  })
  if ($rolls.Count) { $mechanics.rolls = $rolls }
  if ($mechanics.Count) { $entry.mechanics = $mechanics }
  $entry
})

$output = [ordered]@{
  format = "beholden.compendium"
  schema = "grand"
  exportedAt = [DateTime]::UtcNow.ToString("o")
  classes = $classes
  species = $species
  backgrounds = $backgrounds
  feats = $feats
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) { [IO.Directory]::CreateDirectory($outputDirectory) | Out-Null }
[IO.File]::WriteAllText((Join-Path (Get-Location) $OutputPath), ($output | ConvertTo-Json -Depth 100), [Text.UTF8Encoding]::new($false))
Write-Output "Converted $($classes.Count) classes, $($species.Count) species, $($backgrounds.Count) backgrounds, and $($feats.Count) feats to $OutputPath."
