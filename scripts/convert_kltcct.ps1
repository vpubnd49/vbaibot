$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

$baseDir = "e:\OneDrive\HSCV\Antigravity\vbaibot\bosung\lylich"
$files = Get-ChildItem -LiteralPath $baseDir -Filter "*KLTCCT*.doc"

foreach ($file in $files) {
    Write-Output "Found file: $($file.FullName)"
    $doc = $word.Documents.Open($file.FullName, $false, $true)
    
    $docxPath = Join-Path $baseDir "KLTCCT_converted.docx"
    $txtPath = Join-Path $baseDir "KLTCCT_extracted.txt"
    
    $text = $doc.Content.Text
    [System.IO.File]::WriteAllText($txtPath, $text, [System.Text.Encoding]::UTF8)
    
    $doc.SaveAs2($docxPath, 16) # wdFormatXMLDocument (.docx)
    $doc.Close(0)
    Write-Output "Saved to $docxPath and $txtPath"
}

$word.Quit()
Write-Output "Done!"
