param(
    [string]$Version = "latest",
    [switch]$Latest,
    [switch]$Css,
    [switch]$NoCss,
    [switch]$Md,
    [switch]$NoMd,
    [switch]$Vue,
    [switch]$NoVue,
    [switch]$Auto,
    [switch]$Recursive,
    [switch]$Markdown,
    [switch]$NoMarkdown,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
Usage:
  Install-VSCodeEslintDefaults [-Version <v> | -Latest] [-Css | -NoCss] [-Md | -NoMd] [-Vue | -NoVue] [-Auto] [-Recursive]

Defaults:
  Version: latest GitHub release (or $env:VSCODE_ESLINT_DEFAULTS_VERSION)
  Css: disabled unless -Css is provided
  Markdown: enabled unless -NoMd is provided
  Vue: disabled unless -Vue is provided (or inferred with -Auto)
  Recursive: off unless -Recursive is provided; updates eligible pnpm workspace package scripts
"@
    exit 0
}

function Resolve-VSCodeEslintDefaultsVersion {
    param(
        [string]$Version,
        [switch]$Latest
    )

    $resolvedVersion = if ($Latest) {
        "latest"
    } elseif ($env:VSCODE_ESLINT_DEFAULTS_VERSION) {
        $env:VSCODE_ESLINT_DEFAULTS_VERSION
    } else {
        $Version
    }

    if ($resolvedVersion -eq "latest") {
        return "latest"
    }

    return $resolvedVersion.TrimStart("v")
}

function Get-VSCodeEslintDefaultsArchiveUrl {
    param(
        [string]$Version
    )

    if ($Version -eq "latest") {
        return "https://github.com/technomoron/vscode-eslint-defaults/releases/latest/download/installer.tgz"
    }

    return "https://github.com/technomoron/vscode-eslint-defaults/releases/download/v$Version/installer.tgz"
}

function Get-VSCodeEslintDefaultsLintconfigArgs {
    param(
        [bool]$CssEnabled,
        [bool]$MarkdownEnabled,
        [string]$VueMode,
        [bool]$AutoMode,
        [bool]$CssExplicit,
        [bool]$MarkdownExplicit,
        [bool]$VueExplicit,
        [bool]$Recursive
    )

    $args = @()
    if ($AutoMode) {
        $args += "--auto"
        if ($CssExplicit) { $args += if ($CssEnabled) { "--css" } else { "--no-css" } }
        if ($MarkdownExplicit) { $args += if ($MarkdownEnabled) { "--md" } else { "--no-md" } }
        if ($VueExplicit) { $args += if ($VueMode -eq "on") { "--vue" } else { "--no-vue" } }
    } else {
        $args += if ($CssEnabled) { "--css" } else { "--no-css" }
        $args += if ($MarkdownEnabled) { "--md" } else { "--no-md" }
        $args += if ($VueMode -eq "on") { "--vue" } else { "--no-vue" }
    }
    if ($Recursive) {
        $args += "--recursive"
    }

    return $args -join " "
}

function Install-VSCodeEslintDefaults {
    param(
        [string]$Version = "latest",
        [switch]$Latest,
        [switch]$Css,
        [switch]$NoCss,
        [switch]$Md,
        [switch]$NoMd,
        [switch]$Vue,
        [switch]$NoVue,
        [switch]$Auto,
        [switch]$Recursive,
        [switch]$Markdown,
        [switch]$NoMarkdown
    )

    $resolvedVersion = Resolve-VSCodeEslintDefaultsVersion -Version $Version -Latest:$Latest
    $cssEnabled = $false
    if ($NoCss) { $cssEnabled = $false }
    elseif ($Css) { $cssEnabled = $true }

    $markdownEnabled = $true
    if ($NoMd -or $NoMarkdown) { $markdownEnabled = $false }
    elseif ($Md -or $Markdown) { $markdownEnabled = $true }

    $vueMode = "off"
    if ($NoVue) { $vueMode = "off" }
    elseif ($Vue) { $vueMode = "on" }
    $cssExplicit = $Css -or $NoCss
    $markdownExplicit = $Md -or $NoMd -or $Markdown -or $NoMarkdown
    $vueExplicit = $Vue -or $NoVue
    $lintconfigArgs = Get-VSCodeEslintDefaultsLintconfigArgs -CssEnabled $cssEnabled -MarkdownEnabled $markdownEnabled -VueMode $vueMode -AutoMode $Auto -CssExplicit $cssExplicit -MarkdownExplicit $markdownExplicit -VueExplicit $vueExplicit -Recursive $Recursive
    $runningOnWindows = $env:OS -eq "Windows_NT"

    if (-not $runningOnWindows -and $resolvedVersion -ne "latest") {
        $bashCmd = Get-Command bash -ErrorAction SilentlyContinue
        $curlCmd = Get-Command curl -ErrorAction SilentlyContinue
        $tarCmd = Get-Command tar -ErrorAction SilentlyContinue

        if ($bashCmd -and $curlCmd -and $tarCmd) {
            $tmpInstallSh = Join-Path ([System.IO.Path]::GetTempPath()) ("vscode-eslint-defaults-install-{0}.sh" -f [System.Guid]::NewGuid().ToString("N"))
            $scriptUrl = "https://raw.githubusercontent.com/technomoron/vscode-eslint-defaults/v$resolvedVersion/install.sh"
            $bashArgs = @("--version=$resolvedVersion")

            if ($cssExplicit) { if ($cssEnabled) { $bashArgs += "--css" } else { $bashArgs += "--no-css" } }
            if ($markdownExplicit) { if ($markdownEnabled) { $bashArgs += "--md" } else { $bashArgs += "--no-md" } }
            if ($vueExplicit) { if ($vueMode -eq "on") { $bashArgs += "--vue" } else { $bashArgs += "--no-vue" } }
            if ($Auto) { $bashArgs += "--auto" }
            if ($Recursive) { $bashArgs += "--recursive" }

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
    }

    $archiveUrl = Get-VSCodeEslintDefaultsArchiveUrl -Version $resolvedVersion
    $tmpDir = Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath ([System.IO.Path]::GetRandomFileName())
    New-Item -ItemType Directory -Path $tmpDir | Out-Null
    $archivePath = Join-Path $tmpDir "installer.tgz"

    Write-Host "Downloading installer $resolvedVersion..."
    Invoke-WebRequest -Uri $archiveUrl -OutFile $archivePath -UseBasicParsing

    Write-Host "Extracting installer files..."
    if ($runningOnWindows) {
        $tarCandidates = @(
            (Join-Path $env:SystemRoot "System32\tar.exe"),
            (Join-Path $env:SystemRoot "Sysnative\tar.exe")
        )
        $tarPath = $tarCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
        if (-not $tarPath) {
            throw "Windows tar.exe not found under $env:SystemRoot."
        }
        & $tarPath -xzf $archivePath -C (Get-Location)
    } else {
        tar -xzf $archivePath -C (Get-Location)
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to extract installer archive."
    }

    Write-Host "Running configure-eslint.cjs..."
    $env:INSTALL_CSS = if ($cssEnabled) { "1" } else { "0" }
    $env:INSTALL_MARKDOWN = if ($markdownEnabled) { "1" } else { "0" }
    $env:INSTALL_VUE = $vueMode
    $env:INSTALL_AUTO = if ($Auto) { "1" } else { "0" }
    $env:INSTALL_RECURSIVE = if ($Recursive) { "1" } else { "0" }
    $env:INSTALL_CSS_EXPLICIT = if ($cssExplicit) { "1" } else { "0" }
    $env:INSTALL_MARKDOWN_EXPLICIT = if ($markdownExplicit) { "1" } else { "0" }
    $env:INSTALL_VUE_EXPLICIT = if ($vueExplicit) { "1" } else { "0" }
    $env:INSTALL_LINTCONFIG_ARGS = $lintconfigArgs
    node .\configure-eslint.cjs

    if (-not $cssEnabled -and -not $Auto) {
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

if ($MyInvocation.MyCommand.Path -and $MyInvocation.InvocationName -ne ".") {
    Install-VSCodeEslintDefaults -Version $Version -Latest:$Latest -Css:$Css -NoCss:$NoCss -Md:$Md -NoMd:$NoMd -Vue:$Vue -NoVue:$NoVue -Auto:$Auto -Recursive:$Recursive -Markdown:$Markdown -NoMarkdown:$NoMarkdown
}
