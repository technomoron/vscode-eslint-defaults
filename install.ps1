param(
    [string]$Version = "",
    [switch]$Latest,
    [switch]$Css,
    [switch]$NoCss,
    [switch]$Md,
    [switch]$NoMd,
    [switch]$Vue,
    [switch]$NoVue,
    [switch]$Auto,
    [switch]$Recursive,
    [switch]$PurgeLintDeps,
    [switch]$Markdown,
    [switch]$NoMarkdown,
    [switch]$Help
)

if ($Help) {
    Write-Host @'
Usage:
  Install-VSCodeEslintDefaults [-Version <v> | -Latest] [-Css | -NoCss] [-Md | -NoMd]
                               [-Vue | -NoVue] [-Auto] [-Recursive] [-PurgeLintDeps]

Defaults:
  Version:       latest GitHub release. -Version wins over the
                 VSCODE_ESLINT_DEFAULTS_VERSION environment variable.
  Css:           disabled unless -Css is provided
  Markdown:      enabled unless -NoMd is provided
  Vue:           disabled unless -Vue is provided (or inferred with -Auto)
  Recursive:     off unless -Recursive is provided; updates eligible pnpm
                 workspace package scripts
  PurgeLintDeps: off unless provided; also removes lint packages this
                 installer does not manage
'@
    exit 0
}

function Resolve-VSCodeEslintDefaultsVersion {
    param(
        [string]$Version,
        [switch]$Latest
    )

    # An explicitly passed -Version beats the environment variable, matching
    # install.sh.
    $resolvedVersion = if ($Latest) {
        "latest"
    } elseif ($Version) {
        $Version
    } elseif ($env:VSCODE_ESLINT_DEFAULTS_VERSION) {
        $env:VSCODE_ESLINT_DEFAULTS_VERSION
    } else {
        "latest"
    }

    if ($resolvedVersion -eq "latest") {
        return "latest"
    }

    return $resolvedVersion.TrimStart("v")
}

function Get-VSCodeEslintDefaultsAssetBase {
    param(
        [string]$Version
    )

    if ($Version -eq "latest") {
        return "https://github.com/technomoron/vscode-eslint-defaults/releases/latest/download"
    }

    return "https://github.com/technomoron/vscode-eslint-defaults/releases/download/v$Version"
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
        [bool]$Recursive,
        [bool]$PurgeLintDeps
    )

    $flags = @()
    if ($AutoMode) {
        $flags += "--auto"
        if ($CssExplicit) { $flags += if ($CssEnabled) { "--css" } else { "--no-css" } }
        if ($MarkdownExplicit) { $flags += if ($MarkdownEnabled) { "--md" } else { "--no-md" } }
        if ($VueExplicit) { $flags += if ($VueMode -eq "on") { "--vue" } else { "--no-vue" } }
    } else {
        $flags += if ($CssEnabled) { "--css" } else { "--no-css" }
        $flags += if ($MarkdownEnabled) { "--md" } else { "--no-md" }
        $flags += if ($VueMode -eq "on") { "--vue" } else { "--no-vue" }
    }
    if ($Recursive) { $flags += "--recursive" }
    if ($PurgeLintDeps) { $flags += "--purge-lint-deps" }

    return $flags -join " "
}

function Get-VSCodeEslintDefaultsTarPath {
    $candidates = @(
        (Join-Path $env:SystemRoot "System32\tar.exe"),
        (Join-Path $env:SystemRoot "Sysnative\tar.exe")
    )
    $tarPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $tarPath) {
        throw "Windows tar.exe not found under $env:SystemRoot."
    }

    return $tarPath
}

# Checksums are published next to the archive. Releases made before this check
# existed have no .sha256 asset, so a missing file warns instead of failing.
function Test-VSCodeEslintDefaultsChecksum {
    param(
        [string]$ArchivePath,
        [string]$ChecksumUrl,
        [string]$Label
    )

    $checksumPath = "$ArchivePath.sha256"
    try {
        Invoke-WebRequest -Uri $ChecksumUrl -OutFile $checksumPath -UseBasicParsing
    } catch {
        Write-Warning "No installer.tgz.sha256 published for $Label; skipping checksum verification."
        return
    }

    $expected = ((Get-Content -Raw $checksumPath).Trim() -split '\s+')[0].ToLowerInvariant()
    $actual = (Get-FileHash -Algorithm SHA256 -Path $ArchivePath).Hash.ToLowerInvariant()

    if ($expected -ne $actual) {
        throw "Checksum mismatch for installer.tgz: expected $expected, got $actual."
    }

    Write-Host "Installer checksum verified."
}

function Install-VSCodeEslintDefaults {
    param(
        [string]$Version = "",
        [switch]$Latest,
        [switch]$Css,
        [switch]$NoCss,
        [switch]$Md,
        [switch]$NoMd,
        [switch]$Vue,
        [switch]$NoVue,
        [switch]$Auto,
        [switch]$Recursive,
        [switch]$PurgeLintDeps,
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
    $lintconfigArgs = Get-VSCodeEslintDefaultsLintconfigArgs -CssEnabled $cssEnabled -MarkdownEnabled $markdownEnabled -VueMode $vueMode -AutoMode $Auto -CssExplicit $cssExplicit -MarkdownExplicit $markdownExplicit -VueExplicit $vueExplicit -Recursive $Recursive -PurgeLintDeps $PurgeLintDeps
    $runningOnWindows = $env:OS -eq "Windows_NT"

    if (-not $runningOnWindows) {
        $bashCmd = Get-Command bash -ErrorAction SilentlyContinue
        $curlCmd = Get-Command curl -ErrorAction SilentlyContinue
        $tarCmd = Get-Command tar -ErrorAction SilentlyContinue

        if ($bashCmd -and $curlCmd -and $tarCmd) {
            $scriptRef = if ($resolvedVersion -eq "latest") { "master" } else { "v$resolvedVersion" }
            $tmpInstallSh = Join-Path ([System.IO.Path]::GetTempPath()) ("vscode-eslint-defaults-install-{0}.sh" -f [System.Guid]::NewGuid().ToString("N"))
            $scriptUrl = "https://raw.githubusercontent.com/technomoron/vscode-eslint-defaults/$scriptRef/install.sh"
            $bashArgs = if ($resolvedVersion -eq "latest") { @("--latest") } else { @("--version=$resolvedVersion") }

            if ($cssExplicit) { if ($cssEnabled) { $bashArgs += "--css" } else { $bashArgs += "--no-css" } }
            if ($markdownExplicit) { if ($markdownEnabled) { $bashArgs += "--md" } else { $bashArgs += "--no-md" } }
            if ($vueExplicit) { if ($vueMode -eq "on") { $bashArgs += "--vue" } else { $bashArgs += "--no-vue" } }
            if ($Auto) { $bashArgs += "--auto" }
            if ($Recursive) { $bashArgs += "--recursive" }
            if ($PurgeLintDeps) { $bashArgs += "--purge-lint-deps" }

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

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "node was not found on PATH. Node.js 24 or newer is required."
    }

    $assetBase = Get-VSCodeEslintDefaultsAssetBase -Version $resolvedVersion
    $tmpDir = Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath ([System.IO.Path]::GetRandomFileName())
    New-Item -ItemType Directory -Path $tmpDir | Out-Null
    $archivePath = Join-Path $tmpDir "installer.tgz"

    try {
        Write-Host "Downloading installer $resolvedVersion..."
        Invoke-WebRequest -Uri "$assetBase/installer.tgz" -OutFile $archivePath -UseBasicParsing
        Test-VSCodeEslintDefaultsChecksum -ArchivePath $archivePath -ChecksumUrl "$assetBase/installer.tgz.sha256" -Label $resolvedVersion

        # Unpack outside the project. configure-eslint.cjs copies what it needs
        # from here and keeps a .bak of anything it replaces.
        Write-Host "Extracting installer files..."
        if ($runningOnWindows) {
            & (Get-VSCodeEslintDefaultsTarPath) -xzf $archivePath -C $tmpDir
        } else {
            tar -xzf $archivePath -C $tmpDir
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
        $env:INSTALL_PURGE_LINT_DEPS = if ($PurgeLintDeps) { "1" } else { "0" }
        $env:INSTALL_CSS_EXPLICIT = if ($cssExplicit) { "1" } else { "0" }
        $env:INSTALL_MARKDOWN_EXPLICIT = if ($markdownExplicit) { "1" } else { "0" }
        $env:INSTALL_VUE_EXPLICIT = if ($vueExplicit) { "1" } else { "0" }
        $env:INSTALL_LINTCONFIG_ARGS = $lintconfigArgs

        node (Join-Path $tmpDir "configure-eslint.cjs")
        if ($LASTEXITCODE -ne 0) {
            throw "configure-eslint.cjs failed with exit code $LASTEXITCODE."
        }

        Write-Host "Done."
    } finally {
        # These are read by configure-eslint.cjs, so leaving them set would seed
        # any later run in the same shell session.
        foreach ($name in @(
            "INSTALL_CSS", "INSTALL_MARKDOWN", "INSTALL_VUE", "INSTALL_AUTO",
            "INSTALL_RECURSIVE", "INSTALL_PURGE_LINT_DEPS", "INSTALL_CSS_EXPLICIT",
            "INSTALL_MARKDOWN_EXPLICIT", "INSTALL_VUE_EXPLICIT", "INSTALL_LINTCONFIG_ARGS"
        )) {
            Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
        }
        Remove-Item -Force -Recurse $tmpDir -ErrorAction SilentlyContinue
    }
}

if ($MyInvocation.MyCommand.Path -and $MyInvocation.InvocationName -ne ".") {
    Install-VSCodeEslintDefaults -Version $Version -Latest:$Latest -Css:$Css -NoCss:$NoCss -Md:$Md -NoMd:$NoMd -Vue:$Vue -NoVue:$NoVue -Auto:$Auto -Recursive:$Recursive -PurgeLintDeps:$PurgeLintDeps -Markdown:$Markdown -NoMarkdown:$NoMarkdown
}
