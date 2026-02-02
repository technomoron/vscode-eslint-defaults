param(
    [string]$Version = "1.0.35",
    [switch]$Css,
    [switch]$NoCss,
    [switch]$Md,
    [switch]$NoMd,
    [switch]$Vue,
    [switch]$NoVue,
    [switch]$Markdown,
    [switch]$NoMarkdown,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
Usage:
  Install-VSCodeEslintDefaults [-Version <v>] [-Css | -NoCss] [-Md | -NoMd] [-Vue | -NoVue]

Defaults:
  Version: 1.0.35 (or $env:VSCODE_ESLINT_DEFAULTS_VERSION)
  Css: disabled unless -Css is provided
  Markdown: enabled unless -NoMd is provided
  Vue: auto-detect unless -Vue or -NoVue is provided
"@
    exit 0
}

function Install-VSCodeEslintDefaults {
    param(
        [string]$Version = "1.0.35",
        [switch]$Css,
        [switch]$NoCss,
        [switch]$Md,
        [switch]$NoMd,
        [switch]$Vue,
        [switch]$NoVue,
        [switch]$Markdown,
        [switch]$NoMarkdown
    )

    $resolvedVersion = if ($env:VSCODE_ESLINT_DEFAULTS_VERSION) { $env:VSCODE_ESLINT_DEFAULTS_VERSION } else { $Version }
    $cssEnabled = $false
    if ($NoCss) { $cssEnabled = $false }
    elseif ($Css) { $cssEnabled = $true }

    $markdownEnabled = $true
    if ($NoMd -or $NoMarkdown) { $markdownEnabled = $false }
    elseif ($Md -or $Markdown) { $markdownEnabled = $true }

    $vueMode = "auto"
    if ($NoVue) { $vueMode = "off" }
    elseif ($Vue) { $vueMode = "on" }

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
    $env:INSTALL_VUE = $vueMode
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

Install-VSCodeEslintDefaults -Version $Version -Css:$Css -NoCss:$NoCss -Md:$Md -NoMd:$NoMd -Vue:$Vue -NoVue:$NoVue -Markdown:$Markdown -NoMarkdown:$NoMarkdown
