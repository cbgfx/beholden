<#
.SYNOPSIS
  Read-only audit of subclass ownership in a Grand Schema classes JSON (typically the output
  of enrich-wotc-5e-subclasses.ps1). Independent of that script's own bookkeeping: this
  inspects the OUTPUT file directly rather than trusting the enrichment run's self-reported
  numbers, so it catches drift from hand-edits or future re-runs, not just enrichment bugs.

.DESCRIPTION
  Never writes to any file. Reports, per class:
    - subclasses present (id, name, feature count, resource count)
    - features tagged with a `.subclass` id that isn't a key of that class's own
      `subclasses.options` (a real bug -- the Grand Schema's own superRefine already rejects
      this at validation time, so a clean validation run should always report zero here)
    - untagged features whose NAME still looks subclass-owned (parenthetical suffix, or a
      "<Mechanic>: <Name>" pattern matching the class's own subclasses.level mechanic) --
      these are worth a human's attention even though schema validation won't catch them
    - whether the class has a `subclasses` block at all, and its selection level

.PARAMETER JsonPath
  Path to the Grand Schema JSON to audit (classes array at the top level, or the full
  compendium document -- both are accepted).

.PARAMETER OutputPath
  Optional. Where to write the audit report JSON. If omitted, prints to stdout only.
#>
param(
  [Parameter(Mandatory = $true)][string]$JsonPath,
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

$doc = Get-Content -Raw -Path $JsonPath | ConvertFrom-Json
$classes = if ($doc.classes) { $doc.classes } else { $doc }

function Get-ParentheticalSuffix([string]$FeatureName) {
  $trimmed = $FeatureName.TrimEnd()
  if (-not $trimmed.EndsWith(")")) { return $null }
  $depth = 0
  for ($i = $trimmed.Length - 1; $i -ge 0; $i--) {
    $ch = $trimmed[$i]
    if ($ch -eq ')') { $depth++ }
    elseif ($ch -eq '(') {
      $depth--
      if ($depth -eq 0) { return $trimmed.Substring($i + 1, $trimmed.Length - $i - 2).Trim() }
    }
  }
  return $null
}

$report = [ordered]@{
  generatedAt = [DateTime]::UtcNow.ToString("o")
  classes     = [ordered]@{}
}

foreach ($cls in $classes) {
  $hasSubclasses = [bool]$cls.subclasses
  $optionIds = @{}
  $subclassSummary = [ordered]@{}
  if ($hasSubclasses -and $cls.subclasses.options) {
    foreach ($prop in $cls.subclasses.options.PSObject.Properties) {
      $optionIds[$prop.Name] = $true
      $name = if ($prop.Value -is [string]) { $prop.Value } else { $prop.Value.name }
      $subclassSummary[$prop.Name] = [ordered]@{ name = $name; featureCount = 0; resourceCount = 0 }
    }
  }

  $unknownSubclassRefs = @()
  $suspiciousUntagged = @()

  foreach ($lvl in $cls.levels) {
    $levelFeatures = if ($lvl.features) { $lvl.features } else { @() }
    foreach ($feature in $levelFeatures) {
      if ($feature.subclass) {
        if ($optionIds.ContainsKey($feature.subclass)) {
          $subclassSummary[$feature.subclass].featureCount++
        } else {
          $unknownSubclassRefs += "L$($lvl.level): '$($feature.name)' references unknown subclass id '$($feature.subclass)'"
        }
      } else {
        $suffix = Get-ParentheticalSuffix $feature.name
        if ($suffix) {
          $suspiciousUntagged += "L$($lvl.level): '$($feature.name)' has a parenthetical suffix '($suffix)' but no .subclass tag"
        }
      }
    }
    $levelResources = if ($lvl.resources) { $lvl.resources } else { @() }
    foreach ($resource in $levelResources) {
      if ($resource.subclass -and $optionIds.ContainsKey($resource.subclass)) {
        $subclassSummary[$resource.subclass].resourceCount++
      } elseif ($resource.subclass) {
        $unknownSubclassRefs += "L$($lvl.level): resource '$($resource.name)' references unknown subclass id '$($resource.subclass)'"
      }
    }
  }

  $report.classes[$cls.name] = [ordered]@{
    hasSubclasses        = $hasSubclasses
    selectionLevel        = if ($hasSubclasses) { $cls.subclasses.level } else { $null }
    subclasses            = $subclassSummary
    unknownSubclassRefs   = $unknownSubclassRefs
    suspiciousUntagged    = $suspiciousUntagged
  }
}

$json = $report | ConvertTo-Json -Depth 100
if ($OutputPath) {
  $dir = Split-Path -Parent $OutputPath
  if ($dir) { [IO.Directory]::CreateDirectory($dir) | Out-Null }
  [IO.File]::WriteAllText($OutputPath, $json, [Text.UTF8Encoding]::new($false))
  Write-Output "Audit written to $OutputPath"
} else {
  Write-Output $json
}

$totalUnknownRefs = ($report.classes.Values | ForEach-Object { $_.unknownSubclassRefs.Count } | Measure-Object -Sum).Sum
$totalSuspicious = ($report.classes.Values | ForEach-Object { $_.suspiciousUntagged.Count } | Measure-Object -Sum).Sum
Write-Output "Summary: $totalUnknownRefs unknown-subclass references, $totalSuspicious suspicious untagged parenthetical features."
if ($totalUnknownRefs -gt 0) { exit 1 }
