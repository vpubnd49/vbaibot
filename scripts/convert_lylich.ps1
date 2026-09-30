$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

$docPath = "e:\OneDrive\HSCV\Antigravity\vbaibot\bosung\lylich\2C.doc"
$docxPath = "e:\OneDrive\HSCV\Antigravity\vbaibot\bosung\lylich\2C_converted.docx"
$txtPath = "e:\OneDrive\HSCV\Antigravity\vbaibot\bosung\lylich\2C_extracted.txt"

Write-Output "Opening $docPath..."
$doc = $word.Documents.Open($docPath, $false, $true) # ReadOnly = true
Write-Output "Extracting text..."
$text = $doc.Content.Text
[System.IO.File]::WriteAllText($txtPath, $text, [System.Text.Encoding]::UTF8)

Write-Output "Saving as docx..."
$doc.SaveAs2($docxPath, 16)
$doc.Close([Microsoft.Office.Interop.Word.WdSaveOptions]::wdDoNotSaveChanges)

$docPath2 = "e:\OneDrive\HSCV\Antigravity\vbaibot\bosung\lylich\Mẫu khai lý lịch dùng trong Công tác KLTCCT 2026.doc"
$docxPath2 = "e:\OneDrive\HSCV\Antigravity\vbaibot\bosung\lylich\KLTCCT_converted.docx"
$txtPath2 = "e:\OneDrive\HSCV\Antigravity\vbaibot\bosung\lylich\KLTCCT_extracted.txt"

Write-Output "Opening $docPath2..."
$doc2 = $word.Documents.Open($docPath2, $false, $true)
$text2 = $doc2.Content.Text
[System.IO.File]::WriteAllText($txtPath2, $text2, [System.Text.Encoding]::UTF8)
$doc2.SaveAs2($docxPath2, 16)
$doc2.Close([Microsoft.Office.Interop.Word.WdSaveOptions]::wdDoNotSaveChanges)

$word.Quit()
Write-Output "Done all conversions!"
