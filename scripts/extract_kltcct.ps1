
 = New-Object -ComObject Word.Application
.Visible = False
.DisplayAlerts = 0

 = Get-ChildItem -LiteralPath 'e:\OneDrive\HSCV\Antigravity\vbaibot\bosung\lylich' -Filter '*.doc' | Where-Object { .Name -like '*KLTCCT*' }
if () {
     = .Documents.Open(.FullName, False, True)
     = .Content.Text
    [System.IO.File]::WriteAllText('e:\OneDrive\HSCV\Antigravity\vbaibot\bosung\lylich\KLTCCT_extracted.txt', , [System.Text.Encoding]::UTF8)
    .Close(0)
    Write-Output 'Extracted KLTCCT'
}
.Quit()
