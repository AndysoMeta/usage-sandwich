// Listens once through the microphone and returns what you said.
// Uses the speech recognition built into Windows: nothing to download, no account, no cost.
const { execFile } = require('node:child_process')

const LISTEN_PS = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$r = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$r.SetInputToDefaultAudioDevice()
$r.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$r.InitialSilenceTimeout = [TimeSpan]::FromSeconds(6)
$r.EndSilenceTimeout = [TimeSpan]::FromSeconds(1.2)
$res = $r.Recognize([TimeSpan]::FromSeconds(20))
if ($res) { Write-Output $res.Text }
`

function encoded(script) {
  return Buffer.from(script, 'utf16le').toString('base64')
}

function listenOnce() {
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('Voice works on Windows for now. Double-click the burger to type instead.'))
  }
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded(LISTEN_PS)],
      { windowsHide: true, timeout: 30000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(String(stderr).trim().split(/\r?\n/)[0] || "Couldn't use the microphone"))
        resolve(String(stdout).trim())
      },
    )
  })
}

module.exports = { listenOnce, LISTEN_PS, encoded }
