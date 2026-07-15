Get-ChildItem -Path D:/rongcheng-admin/server/src -Recurse -Include "*.ts" | ForEach-Object {
    $c = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($c -and ($c -match "multer|image/|fileFilter|\.jpg|\.png|\.webp|\.gif|accepted|allow")) {
        Write-Host $_.FullName
    }
}
