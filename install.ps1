param(
    [string]$Version = "1.0.39",
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
  Version: 1.0.39 (or $env:VSCODE_ESLINT_DEFAULTS_VERSION)
  Css: disabled unless -Css is provided
  Markdown: enabled unless -NoMd is provided
  Vue: auto-detect unless -Vue or -NoVue is provided
"@
    exit 0
}

function Install-VSCodeEslintDefaults {
    param(
        [string]$Version = "1.0.39",
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

    $bashCmd = Get-Command bash -ErrorAction SilentlyContinue
    $curlCmd = Get-Command curl -ErrorAction SilentlyContinue
    $tarCmd = Get-Command tar -ErrorAction SilentlyContinue

    if ($bashCmd -and $curlCmd -and $tarCmd) {
        $tmpInstallSh = Join-Path $env:TEMP ("vscode-eslint-defaults-install-{0}.sh" -f [System.Guid]::NewGuid().ToString("N"))
        $scriptUrl = "https://raw.githubusercontent.com/technomoron/vscode-eslint-defaults/v$resolvedVersion/install.sh"
        $bashArgs = @("--version=$resolvedVersion")

        if ($cssEnabled) { $bashArgs += "--css" } else { $bashArgs += "--no-css" }
        if ($markdownEnabled) { $bashArgs += "--md" } else { $bashArgs += "--no-md" }
        if ($vueMode -eq "on") { $bashArgs += "--vue" }
        elseif ($vueMode -eq "off") { $bashArgs += "--no-vue" }

        try {
            Write-Host "Detected bash/curl/tar; using install.sh path..."
            Invoke-WebRequest -Uri $scriptUrl -OutFile $tmpInstallSh -UseBasicParsing
            & $bashCmd.Source $tmpInstallSh @bashArgs
            if ($LASTEXITCODE -eq 0) {
                return
            }
            Write-Warning "bash installer exited with code $LASTEXITCODE; falling back to PowerShell installer."
        } catch {
            Write-Warning "bash installer path failed ($($_.Exception.Message)); falling back to PowerShell installer."
        } finally {
            Remove-Item -Force $tmpInstallSh -ErrorAction SilentlyContinue
        }
    }

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
