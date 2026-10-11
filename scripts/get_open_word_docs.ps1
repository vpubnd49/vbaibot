try {
    $word = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
    foreach ($doc in $word.Documents) {
        Write-Output $doc.FullName
    }
} catch {
    Write-Output "Error: $_"
}
