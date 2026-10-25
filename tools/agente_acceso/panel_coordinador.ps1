$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'verificar_enlace.ps1')
. (Join-Path $PSScriptRoot 'enlace_funciones.ps1')
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$enRoot=$PSScriptRoot
$script:enChild=$null
$enForm=New-Object System.Windows.Forms.Form
$enForm.Text='San Isidro | Control candidato de ensayo'
$enForm.ClientSize=New-Object System.Drawing.Size(890,590)
$enForm.StartPosition='CenterScreen'
$enForm.Font=New-Object System.Drawing.Font('Segoe UI',10)
$enForm.BackColor=[System.Drawing.ColorTranslator]::FromHtml('#F5F4F2')
$enTitle=New-Object System.Windows.Forms.Label
$enTitle.SetBounds(20,15,850,60)
$enTitle.Text='Candidato separado. Controla el ensayo readonly y consulta salud. Preparar y reanudar delegan al gestor r2 instalado. No usar otros lectores durante la transicion.'
$enForm.Controls.Add($enTitle)
$enOutput=New-Object System.Windows.Forms.TextBox
$enOutput.SetBounds(20,170,850,350)
$enOutput.Multiline=$true
$enOutput.ScrollBars='Both'
$enOutput.ReadOnly=$true
$enOutput.WordWrap=$false
$enOutput.Font=New-Object System.Drawing.Font('Consolas',9)
$enOutput.Text='Consulta Salud sin mantenimiento. Este panel no inicia SDK ni instala vigilancia.'
$enForm.Controls.Add($enOutput)
$enStatus=New-Object System.Windows.Forms.Label
$enStatus.SetBounds(20,535,850,45)
$enStatus.Text='No cerrar el mantenimiento hasta confirmar cierre y dos ciclos nuevos de r2.'
$enForm.Controls.Add($enStatus)
$enButtons=New-Object System.Collections.ArrayList
function Start-EnAction([string]$action){
    if($null -ne $script:enChild){return}
    if($action -in @('pausar','reanudar')){
        $enChoice=[System.Windows.Forms.MessageBox]::Show(
            "Se ejecutara $action mediante el gestor instalado. No usar otros lectores ni abrir un ensayo durante esta transicion. Continuar?",
            'Operacion de mantenimiento','YesNo','Question')
        if($enChoice -ne 'Yes'){return}
    }
    $enInfo=New-EnControlStartInfo -Root $enRoot -Action $action
    $enProcess=New-Object System.Diagnostics.Process
    $enProcess.StartInfo=$enInfo
    try{
        if(-not $enProcess.Start()){throw 'No inicio el control.'}
        $script:enChild=@{process=$enProcess;stdout=$enProcess.StandardOutput.ReadToEndAsync();stderr=$enProcess.StandardError.ReadToEndAsync();action=$action}
        foreach($enButton in $enButtons){$enButton.Enabled=$false}
        $enStatus.Text='En curso: '+$action+'. Espera; no se fuerzan paradas.'
    }catch{
        $enProcess.Dispose()
        $enStatus.Text='No se inicio el control. Revisar consola.'
    }
}
$enControls=@(Get-EnControlActions)
for($enIndex=0;$enIndex -lt $enControls.Count;$enIndex++){
    $enButton=New-Object System.Windows.Forms.Button
    $enButton.SetBounds((20+($enIndex%3)*285),(80+[math]::Floor($enIndex/3)*40),275,34)
    $enButton.Text=$enControls[$enIndex].label
    $enButton.Tag=$enControls[$enIndex].action
    $enButton.Add_Click({param($sender,$event) Start-EnAction ([string]$sender.Tag)})
    $enForm.Controls.Add($enButton)
    [void]$enButtons.Add($enButton)
}
$enTimer=New-Object System.Windows.Forms.Timer
$enTimer.Interval=500
$enTimer.Add_Tick({
    if($null -eq $script:enChild -or -not $script:enChild.process.HasExited){return}
    if(-not $script:enChild.stdout.IsCompleted -or -not $script:enChild.stderr.IsCompleted){return}
    try{
        $enOutput.Text=$script:enChild.stdout.Result+[Environment]::NewLine+$script:enChild.stderr.Result
        $enStatus.Text=if($script:enChild.process.ExitCode -eq 0){'Control terminado. Revisar resultado; la solicitud de parada no acredita cierre.'}else{'Control NO confirmado. Conservar mantenimiento y evidencia.'}
    }finally{
        $script:enChild.process.Dispose()
        $script:enChild=$null
        foreach($enButton in $enButtons){$enButton.Enabled=$true}
    }
})
$enForm.Add_FormClosing({param($sender,$event)
    if($null -ne $script:enChild){$event.Cancel=$true;$enStatus.Text='Esperar al control en curso; no se matan procesos.'}
})
$enTimer.Start()
try{[void]$enForm.ShowDialog()}finally{$enTimer.Stop();$enTimer.Dispose();$enForm.Dispose()}
