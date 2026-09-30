$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

$docx = "e:\OneDrive\HSCV\Antigravity\vbaibot\bosung\lylich\2C_TruongHaiChau.docx"
$docPath = "e:\OneDrive\HSCV\Antigravity\vbaibot\bosung\lylich\2C_TruongHaiChau.doc"

$doc = $word.Documents.Open($docx, $false, $true)
$doc.SaveAs2($docPath, 0) # 0 = wdFormatDocument (.doc)
$doc.Close(0)
$word.Quit()
Write-Output "Converted 2C_TruongHaiChau.docx to 2C_TruongHaiChau.doc successfully"
