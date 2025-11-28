param(
    [string]$Version = "1.0.30",
    [switch]$Css,
    [switch]$NoCss,
    [switch]$Markdown,
    [switch]$NoMarkdown,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
Usage:
  Install-VSCodeEslintDefaults [-Version <v>] [-Css | -NoCss] [-Markdown | -NoMarkdown]

Defaults:
  Version: 1.0.23 (or $env:VSCODE_ESLINT_DEFAULTS_VERSION)
  Css: enabled unless -NoCss is provided
  Markdown: enabled unless -NoMarkdown is provided
"@
    exit 0
}

function Install-VSCodeEslintDefaults {
    param(
        [string]$Version = "1.0.23",
        [switch]$Css,
        [switch]$NoCss,
        [switch]$Markdown,
        [switch]$NoMarkdown
    )

    $resolvedVersion = if ($env:VSCODE_ESLINT_DEFAULTS_VERSION) { $env:VSCODE_ESLINT_DEFAULTS_VERSION } else { $Version }
    $cssEnabled = $true
    if ($NoCss) { $cssEnabled = $false }
    elseif ($Css) { $cssEnabled = $true }

    $markdownEnabled = $true
    if ($NoMarkdown) { $markdownEnabled = $false }
    elseif ($Markdown) { $markdownEnabled = $true }

    $archiveUrl = "https://github.com/technomoron/vscode-eslint-defaults/releases/download/v$resolvedVersion/installer.tgz"
    $tmpDir = Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath ([System.IO.Path]::GetRandomFileName())
    New-Item -ItemType Directory -Path $tmpDir | Out-Null
    $archivePath = Join-Path $tmpDir "installer.tgz"

    Write-Host "Downloading installer v$resolvedVersion..."
    Invoke-WebRequest -Uri $archiveUrl -OutFile $archivePath -UseBasicParsing

    Write-Host "Extracting installer files..."
    tar -xvzf $archivePath -C (Get-Location)

    Write-Host "Running configure-eslint.cjs..."
    $env:INSTALL_CSS = if ($cssEnabled) { "1" } else { "0" }
    $env:INSTALL_MARKDOWN = if ($markdownEnabled) { "1" } else { "0" }
    node .\configure-eslint.cjs

    if (-not $cssEnabled) {
        $stylelintPath = Join-Path (Get-Location) "stylelint.config.cjs"
        if (Test-Path $stylelintPath) {
            Write-Host "CSS disabled; removing stylelint.config.cjs..."
            Remove-Item -Force $stylelintPath
        }
    }

    Write-Host "Cleaning up..."
    Remove-Item -Force .\configure-eslint.cjs -ErrorAction SilentlyContinue
    Remove-Item -Force -Recurse $tmpDir -ErrorAction SilentlyContinue
}

Install-VSCodeEslintDefaults -Version $Version -Css:$Css -NoCss:$NoCss -Markdown:$Markdown -NoMarkdown:$NoMarkdown
