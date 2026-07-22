<#
.SYNOPSIS
  Reconstructs 5e (2014) subclass ownership from compendium/WotC_5e_only.xml and tags the
  matching features/resources in an already-converted Grand Schema classes JSON.

.DESCRIPTION
  compendium/WotC_5e_only.json's classes have every subclass's features flattened into
  levels[].features[] with no subclass tagging, because convert-wotc-5e-xml.ps1 groups
  <autolevel> nodes only by level (Group-Object on the level attribute), silently merging
  every subclass's same-level nodes into one flat list. This script re-parses the raw XML
  directly (which preserves per-node document order, and thus per-subclass boundaries) and
  writes feature.subclass / resource.subclass / class.subclasses onto a COPY of the input
  JSON. It never reads or writes compendium/WotC_5e_only.json directly -- callers must pass
  an explicit -JsonPath (a temp copy) and -OutputPath (a temp destination).

  Ownership boundaries respected: this script only ever writes levels[].features[].subclass,
  levels[].resources[].subclass, and class.subclasses. It never touches a class's own
  spellcasting/multiclass/primaryAbility/spellLists fields.

.PARAMETER XmlPath
  Path to the raw XML source. Default: compendium/WotC_5e_only.xml

.PARAMETER JsonPath
  Path to the (already-converted) Grand Schema JSON to enrich. Must be a temp copy, never
  the tracked compendium/WotC_5e_only.json.

.PARAMETER OutputPath
  Where the enriched JSON is written. Must differ from JsonPath's tracked original.

.PARAMETER AuditPath
  Where the audit report JSON is written.

.PARAMETER Repo2024Path
  Path to compendium/WotC_2024_only.json, used only to look up existing sc_* IDs for
  subclasses that exist under the same name in both rulesets (read-only).
#>
param(
  [string]$XmlPath = "compendium/WotC_5e_only.xml",
  [Parameter(Mandatory = $true)][string]$JsonPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [string]$AuditPath = "",
  [string]$Repo2024Path = "compendium/WotC_2024_only.json"
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Safety: refuse to ever touch the tracked source files.
# ---------------------------------------------------------------------------
$forbidden = @(
  (Resolve-Path "compendium/WotC_5e_only.json" -ErrorAction SilentlyContinue),
  (Resolve-Path "scripts/convert-wotc-5e-xml.ps1" -ErrorAction SilentlyContinue)
) | Where-Object { $_ }
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
foreach ($f in $forbidden) {
  if ($resolvedOutput -eq $f.Path) {
    throw "Refusing to write to $OutputPath -- this is a tracked source file this script must never modify."
  }
}

# ---------------------------------------------------------------------------
# Helpers (Slug mirrors convert-wotc-5e-xml.ps1's own Slug function exactly,
# so subclass IDs generated here follow the same convention as everything else).
# ---------------------------------------------------------------------------
function Slug([string]$Value) {
  $slug = $Value.ToLowerInvariant() -replace "[^a-z0-9]+", "_"
  return $slug.Trim("_")
}

# Verified directly against compendium/WotC_5e_only.xml: each class repeats exactly one
# generic placeholder feature name at every subclass-feature level in its base progression
# (e.g. Barbarian's "Path Feature" at L6/L10/L14). These never carry a subclass suffix and
# never appear inside a real subclass block -- they describe WHERE a subclass feature slot
# occurs, not WHAT it is, so they stay on the base class untagged (task requirement #7).
$genericPlaceholderByClass = @{
  "Barbarian" = "Path Feature"
  "Bard"      = "Bard College Feature"
  "Cleric"    = "Divine Domain Feature"
  "Druid"     = "Druid Circle Feature"
  "Fighter"   = "Martial Archetype Feature"
  "Monk"      = "Monastic Tradition Feature"
  "Paladin"   = "Sacred Oath Feature"
  "Ranger"    = "Ranger Archetype Feature"
  "Rogue"     = "Roguish Archetype Feature"
  "Sorcerer"  = "Sorcerous Origin Feature"
  "Warlock"   = "Otherworldly Patron Feature"
  "Wizard"    = "Arcane Tradition Feature"
  "Artificer" = "Specialist Feature"
}

# Verified directly against compendium/WotC_5e_only.xml's own "Spells Known" tables in the
# Spellcasting (Eldritch Knight) / Spellcasting (Arcane Trickster) feature text -- both
# third-casters share an identical progression. Slot counts cross-checked against the
# already-fixed compendium/WotC_2024_only.json subclass entries (same slot table is
# confirmed unchanged 2014<->2024; only the known-vs-prepared field semantics differ, and
# per user direction that distinction is a downstream concern, not a schema-shape one --
# the count populates `prepared` directly).
$thirdCasterProgression = @(
  [ordered]@{ level = 3;  cantrips = 2; prepared = 3;  slots = @(2) }
  [ordered]@{ level = 4;  prepared = 4;  slots = @(3) }
  [ordered]@{ level = 5;  slots = @(3) }
  [ordered]@{ level = 6;  slots = @(3) }
  [ordered]@{ level = 7;  prepared = 5;  slots = @(4, 2) }
  [ordered]@{ level = 8;  prepared = 6;  slots = @(4, 2) }
  [ordered]@{ level = 9;  slots = @(4, 2) }
  [ordered]@{ level = 10; cantrips = 3; prepared = 7;  slots = @(4, 3) }
  [ordered]@{ level = 11; prepared = 8;  slots = @(4, 3) }
  [ordered]@{ level = 12; slots = @(4, 3) }
  [ordered]@{ level = 13; prepared = 9;  slots = @(4, 3, 2) }
  [ordered]@{ level = 14; prepared = 10; slots = @(4, 3, 2) }
  [ordered]@{ level = 15; slots = @(4, 3, 2) }
  [ordered]@{ level = 16; prepared = 11; slots = @(4, 3, 3) }
  [ordered]@{ level = 17; slots = @(4, 3, 3) }
  [ordered]@{ level = 18; slots = @(4, 3, 3) }
  [ordered]@{ level = 19; prepared = 12; slots = @(4, 3, 3, 1) }
  [ordered]@{ level = 20; prepared = 13; slots = @(4, 3, 3, 1) }
)
# class name -> subclass name -> (handled specially, third-caster)
$thirdCasterSubclasses = @{
  "Fighter" = "Eldritch Knight"
  "Rogue"   = "Arcane Trickster"
}

function Get-ParentheticalSubclass([string]$FeatureName, [string]$GenericPhrase) {
  # Nested-paren-aware: e.g. "Royal Envoy (Purple Dragon Knight (Banneret))" must yield the
  # FULL "Purple Dragon Knight (Banneret)", not just "Banneret" (naive [^)]+ matching breaks
  # on this -- verified against real Fighter/Banneret data).
  $trimmed = $FeatureName.TrimEnd()
  if (-not $trimmed.EndsWith(")")) { return $null }
  $depth = 0
  for ($i = $trimmed.Length - 1; $i -ge 0; $i--) {
    $ch = $trimmed[$i]
    if ($ch -eq ')') { $depth++ }
    elseif ($ch -eq '(') {
      $depth--
      if ($depth -eq 0) {
        $inner = $trimmed.Substring($i + 1, $trimmed.Length - $i - 2).Trim()
        if ($inner -and $inner -ne $GenericPhrase) { return $inner }
        return $null
      }
    }
  }
  return $null
}

function Get-AnnouncementSubclass([string]$FeatureName, [string]$RequiredPrefix) {
  # "<Mechanic>: <Subclass Name>" e.g. "Primal Path: Path of the Berserker",
  # "Martial Archetype: Eldritch Knight". The prefix must match this class's one true
  # subclass-selection mechanic name (RequiredPrefix, derived once per class) -- otherwise
  # unrelated same-styled feature names (e.g. "Channel Divinity: X (Y Domain)") would be
  # misread as announcing a new subclass instead of falling through to their own trailing
  # parenthetical, which is the real signal for those.
  if ($FeatureName -match '^([^:()]+):\s*(.+)$') {
    $prefix = $Matches[1].Trim()
    if ($RequiredPrefix -and $prefix -ne $RequiredPrefix) { return $null }
    return $Matches[2].Trim()
  }
  return $null
}

# ---------------------------------------------------------------------------
# Load inputs.
# ---------------------------------------------------------------------------
$rawXml = [IO.File]::ReadAllText((Resolve-Path $XmlPath))
$rawXml = $rawXml -replace "</compendium>\s*</xml>\s*$", "</compendium>"
# Explicit XmlDocument + LoadXml (not `[xml]$var = $string`) -- the type-accelerator form can
# throw "This document already has a 'DocumentElement' node" when a same-named variable was
# previously assigned in the calling scope; a fresh object avoids that entirely.
$xmlDoc = New-Object System.Xml.XmlDocument
$xmlDoc.LoadXml($rawXml)
$xmlRoot = $xmlDoc.DocumentElement

# Windows PowerShell 5.1's ConvertFrom-Json has no -AsHashtable / -Depth -- it returns
# PSCustomObject trees. Writes onto those must go through Add-Member -Force (plain property
# assignment only works for properties that already exist).
$json = Get-Content -Raw -Path $JsonPath | ConvertFrom-Json
$repo2024 = Get-Content -Raw -Path $Repo2024Path | ConvertFrom-Json

# class name -> { lowercase subclass name -> sc_id }
$repo2024SubclassIndex = @{}
foreach ($cls in $repo2024.classes) {
  $map = @{}
  if ($cls.subclasses -and $cls.subclasses.options) {
    foreach ($prop in $cls.subclasses.options.PSObject.Properties) {
      $scId = $prop.Name
      $val = $prop.Value
      $name = if ($val -is [string]) { $val } else { $val.name }
      if ($name) { $map[$name.ToLowerInvariant()] = $scId }
    }
  }
  $repo2024SubclassIndex[$cls.name] = $map
}

$audit = [ordered]@{
  generatedAt = [DateTime]::UtcNow.ToString("o")
  classes     = [ordered]@{}
  notes       = @(
    "Eldritch Knight/Arcane Trickster spellcasting.list is set to 'sl_wizard' (the schema requires this field; it's not optional). This matches the exact ID WotC_2024_only.json already uses for these same two subclasses, but no spellLists entry actually exists yet anywhere in WotC_5e_only.json -- not even base Wizard has one (verified). That's a separate worker's territory per this task's ownership boundary; the ID is a forward reference, not fabricated content, and will resolve once base 5e spell-list data lands."
  )
}

# ---------------------------------------------------------------------------
# Per-class processing.
# ---------------------------------------------------------------------------
foreach ($jsonClass in $json.classes) {
  $className = $jsonClass.name
  $xmlClass = $xmlRoot.SelectNodes("./class") | Where-Object { $_.name -eq $className } | Select-Object -First 1
  $classAudit = [ordered]@{
    subclassesFound         = [ordered]@{}
    assignedFeatureCounts   = [ordered]@{}
    unclassifiedFeatures    = @()
    unknownSubclassFeatures = @()
    selectionLevel          = $null
    baseBlockBoundaryNote   = $null
  }

  if (-not $xmlClass) {
    $classAudit.baseBlockBoundaryNote = "No matching <class> found in XML -- skipped entirely."
    $audit.classes[$className] = $classAudit
    continue
  }

  $genericPhrase = $genericPlaceholderByClass[$className]

  # All non-empty autolevel nodes, in raw document order.
  $allNodes = @($xmlClass.SelectNodes("./autolevel")) | Where-Object { @($_.SelectNodes("./feature")).Count -gt 0 }

  # Base-block boundary: the leading run before the first repeated level number.
  $seenLevels = @{}
  $baseBlockEndIndex = -1
  for ($i = 0; $i -lt $allNodes.Count; $i++) {
    $lvl = [int]$allNodes[$i].level
    if ($seenLevels.ContainsKey($lvl)) { $baseBlockEndIndex = $i - 1; break }
    $seenLevels[$lvl] = $true
  }
  if ($baseBlockEndIndex -eq -1) { $baseBlockEndIndex = $allNodes.Count - 1 }
  $maxBaseLevel = ($seenLevels.Keys | Measure-Object -Maximum).Maximum
  if ($maxBaseLevel -ne 20) {
    $classAudit.baseBlockBoundaryNote = "Base block detection reached level $maxBaseLevel before the first repeat, not 20 -- review this class's boundary manually."
  }

  $baseNodes = $allNodes[0..$baseBlockEndIndex]
  $subclassNodes = if ($baseBlockEndIndex + 1 -le $allNodes.Count - 1) { $allNodes[($baseBlockEndIndex + 1)..($allNodes.Count - 1)] } else { @() }

  # Selection level: the level of the FIRST subclass node -- this is where a subclass is
  # actually chosen. (The generic placeholder phrase recurs at LATER levels too, e.g.
  # Barbarian's "Path Feature" at L6/L10/L14 -- searching the base block for its first
  # occurrence gives a later follow-up level, not the true selection level. Verified bug,
  # fixed here: prefer the real subclass-node level, falling back to the base-block search
  # only if there are no subclass nodes at all.)
  $selectionLevel = $null
  if ($subclassNodes.Count -gt 0) { $selectionLevel = [int]$subclassNodes[0].level }
  if (-not $selectionLevel) {
    foreach ($node in $baseNodes) {
      $names = @($node.SelectNodes("./feature/name") | ForEach-Object { $_.InnerText })
      if ($genericPhrase -and ($names -contains $genericPhrase)) { $selectionLevel = [int]$node.level; break }
    }
  }
  $classAudit.selectionLevel = $selectionLevel

  # The one true "<Mechanic>: <Subclass Name>" prefix for this class (e.g. "Divine Domain",
  # "Martial Archetype"), derived from the first subclass node that has a colon announcement.
  # Verified bug fix: without this, unrelated same-styled sub-feature names like "Channel
  # Divinity: Knowledge of the Ages (Knowledge Domain)" get misread as announcing a brand new
  # subclass named "Knowledge of the Ages (Knowledge Domain)" instead of being recognized as
  # a Channel-Divinity option belonging to the already-named "Knowledge Domain" (via its own
  # trailing parenthetical). Only a colon-prefix that matches this exact derived mechanic name
  # counts as a genuine subclass announcement; anything else falls through to the
  # parenthetical-suffix check instead.
  $mechanicPrefix = $null
  foreach ($node in $subclassNodes) {
    $firstName = ($node.SelectNodes("./feature/name") | Select-Object -First 1).InnerText
    if ($firstName -match '^([^:()]+):\s*.+$') { $mechanicPrefix = $Matches[1].Trim(); break }
  }

  # Build JSON level -> features[] index (mutable references into $jsonClass.levels).
  $jsonLevelFeatures = @{}
  foreach ($lvlEntry in $jsonClass.levels) {
    if ($lvlEntry.features) { $jsonLevelFeatures[[int]$lvlEntry.level] = $lvlEntry.features }
  }
  # Per-level cursor: how many JSON features at this level have already been consumed
  # (base block's own features are consumed first, in JSON array order, then each
  # subsequent subclass node's features consume the next slice).
  $levelCursor = @{}

  # Consume the base block's own contribution to each level first (verifies alignment).
  foreach ($node in $baseNodes) {
    $lvl = [int]$node.level
    $names = @($node.SelectNodes("./feature/name") | ForEach-Object { $_.InnerText })
    $cursor = if ($levelCursor.ContainsKey($lvl)) { $levelCursor[$lvl] } else { 0 }
    $jsonFeats = $jsonLevelFeatures[$lvl]
    for ($k = 0; $k -lt $names.Count; $k++) {
      $idx = $cursor + $k
      if ($jsonFeats -and $idx -lt $jsonFeats.Count) {
        if ($jsonFeats[$idx].name -ne $names[$k]) {
          $classAudit.unknownSubclassFeatures += "Alignment mismatch at level $lvl index $idx -- XML says '$($names[$k])', JSON has '$($jsonFeats[$idx].name)'. Base-block consumption skipped for this level from here on."
          break
        }
      }
    }
    $levelCursor[$lvl] = $cursor + $names.Count
  }

  # current subclass context: only ever set by direct signal on the node itself (no
  # inheritance across nodes -- a signal-less node is always reported unclassified, never
  # guessed, per the task's explicit "report uncertain mappings instead of guessing").
  $subclassIdByName = @{}
  foreach ($node in $subclassNodes) {
    $lvl = [int]$node.level
    $featureNodes = @($node.SelectNodes("./feature"))
    $names = @($featureNodes | ForEach-Object { $_.name })

    # Announcement pattern on the node's first feature is checked FIRST: it's the
    # authoritative canonical name (e.g. "Martial Archetype: Purple Dragon Knight
    # (Banneret)" -> "Purple Dragon Knight (Banneret)"). Checking parenthetical suffixes
    # first would truncate names that are themselves parenthesized, like this one, to just
    # "Banneret" -- verified bug, fixed here. Parenthetical suffix scanning is the fallback
    # for continuation nodes that don't carry their own announcement.
    $candidateName = $null
    $a = Get-AnnouncementSubclass $names[0] $mechanicPrefix
    if ($a -and $a -ne $genericPhrase) { $candidateName = $a }
    if (-not $candidateName) {
      foreach ($n in $names) {
        $p = Get-ParentheticalSubclass $n $genericPhrase
        if ($p) { $candidateName = $p; break }
      }
    }

    $cursor = if ($levelCursor.ContainsKey($lvl)) { $levelCursor[$lvl] } else { 0 }
    $jsonFeats = $jsonLevelFeatures[$lvl]

    if (-not $candidateName) {
      foreach ($n in $names) { $classAudit.unclassifiedFeatures += "L$lvl`: $n" }
      $levelCursor[$lvl] = $cursor + $names.Count
      continue
    }

    if (-not $subclassIdByName.ContainsKey($candidateName)) {
      $existing = $repo2024SubclassIndex[$className]
      $scId = $null
      if ($existing -and $existing.ContainsKey($candidateName.ToLowerInvariant())) {
        $scId = $existing[$candidateName.ToLowerInvariant()]
      } else {
        $scId = "sc_$(Slug $className)_$(Slug $candidateName)"
      }
      $subclassIdByName[$candidateName] = $scId
      $classAudit.subclassesFound[$scId] = $candidateName
      $classAudit.assignedFeatureCounts[$scId] = 0
    }
    $scId = $subclassIdByName[$candidateName]

    for ($k = 0; $k -lt $names.Count; $k++) {
      $idx = $cursor + $k
      if ($jsonFeats -and $idx -lt $jsonFeats.Count -and $jsonFeats[$idx].name -eq $names[$k]) {
        Add-Member -InputObject $jsonFeats[$idx] -NotePropertyName "subclass" -NotePropertyValue $scId -Force
        $classAudit.assignedFeatureCounts[$scId] = $classAudit.assignedFeatureCounts[$scId] + 1
      } else {
        $foundName = if ($jsonFeats -and $idx -lt $jsonFeats.Count) { $jsonFeats[$idx].name } else { "<out of range>" }
        $classAudit.unknownSubclassFeatures += "Alignment mismatch at level $lvl index $idx for subclass '$candidateName' -- XML says '$($names[$k])', JSON has '$foundName'."
      }
    }
    $levelCursor[$lvl] = $cursor + $names.Count
  }

  # class.subclasses
  if ($subclassIdByName.Count -gt 0 -and $selectionLevel) {
    $options = [ordered]@{}
    foreach ($name in $subclassIdByName.Keys) {
      $scId = $subclassIdByName[$name]
      if ($thirdCasterSubclasses.ContainsKey($className) -and $thirdCasterSubclasses[$className] -eq $name) {
        $options[$scId] = [ordered]@{
          name         = $name
          spellcasting = [ordered]@{
            ability      = "int"
            # "sl_wizard" matches the exact ID already used by these same two subclasses in
            # WotC_2024_only.json -- required by the schema (SubclassSpellcastingProgressionSchema's
            # `list` field is not optional), and this isn't inventing new content: it's the
            # conventional ID these subclasses will resolve to once base 5e spellLists exist
            # (a separate worker's territory, per this task's ownership boundary).
            list         = "sl_wizard"
            contribution = "third"
            progression  = $thirdCasterProgression
          }
        }
      } else {
        $options[$scId] = $name
      }
    }
    Add-Member -InputObject $jsonClass -NotePropertyName "subclasses" -NotePropertyValue ([pscustomobject][ordered]@{ level = $selectionLevel; options = $options }) -Force
  }

  $audit.classes[$className] = $classAudit
}

# ---------------------------------------------------------------------------
# Write outputs.
# ---------------------------------------------------------------------------
$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) { [IO.Directory]::CreateDirectory($outputDirectory) | Out-Null }
[IO.File]::WriteAllText($OutputPath, ($json | ConvertTo-Json -Depth 100), [Text.UTF8Encoding]::new($false))

if ($AuditPath) {
  $auditDirectory = Split-Path -Parent $AuditPath
  if ($auditDirectory) { [IO.Directory]::CreateDirectory($auditDirectory) | Out-Null }
  [IO.File]::WriteAllText($AuditPath, ($audit | ConvertTo-Json -Depth 100), [Text.UTF8Encoding]::new($false))
}

$totalSubclasses = ($audit.classes.Values | ForEach-Object { $_.subclassesFound.Count } | Measure-Object -Sum).Sum
$totalUnclassified = ($audit.classes.Values | ForEach-Object { $_.unclassifiedFeatures.Count } | Measure-Object -Sum).Sum
$totalMismatches = ($audit.classes.Values | ForEach-Object { $_.unknownSubclassFeatures.Count } | Measure-Object -Sum).Sum
Write-Output "Enriched $($json.classes.Count) classes: $totalSubclasses subclasses found, $totalUnclassified unclassified features, $totalMismatches alignment mismatches. Output: $OutputPath"
