# Opens an .xlsx in real Excel via COM (read-only, no alerts), reports whether Excel had to repair it,
# dumps sheet names + first-sheet A1:D70 (Value2 and displayed Text) and a few cells of every sheet
# into a UTF-8 JSON report, and optionally exports the whole workbook to PDF for visual review.
# ASCII-only source on purpose: Windows PowerShell 5.1 reads BOM-less scripts as the ANSI code page.
param([Parameter(Mandatory = $true)][string]$Path, [string]$ReportPath, [string]$PdfPath)
$ErrorActionPreference = 'Stop'
$report = [ordered]@{ path = $Path; opened = $false; repaired = $false; name = $null; sheets = @(); summary = @(); perSheet = @(); pdf = $null; error = $null }
$x = New-Object -ComObject Excel.Application
$x.Visible = $false
$x.DisplayAlerts = $false
try {
  $wb = $x.Workbooks.Open($Path, 0, $true)
  $report.opened = $true
  $report.name = $wb.Name
  if ($wb.Name -match 'Repaired|\[' ) { $report.repaired = $true }
  foreach ($ws in $wb.Worksheets) {
    $report.sheets += $ws.Name
    $used = $ws.UsedRange
    $report.perSheet += [ordered]@{ name = $ws.Name; usedRows = $used.Rows.Count; usedCols = $used.Columns.Count; A1 = $ws.Cells.Item(1, 1).Text; freeze = $null }
  }
  $s = $wb.Worksheets.Item(1)
  for ($r = 1; $r -le 70; $r++) {
    $row = @()
    for ($c = 1; $c -le 4; $c++) {
      $cell = $s.Cells.Item($r, $c)
      $v = $cell.Value2
      $t = if ($null -eq $v) { 'null' } else { $v.GetType().Name }
      $row += [ordered]@{ v = $v; text = $cell.Text; type = $t }
    }
    $report.summary += , $row
  }
  if ($PdfPath) { $wb.ExportAsFixedFormat(0, $PdfPath); $report.pdf = $PdfPath }
  $wb.Close($false)
} catch {
  $report.error = $_.Exception.Message
} finally {
  $x.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($x)
}
$json = $report | ConvertTo-Json -Depth 6
if ($ReportPath) { [IO.File]::WriteAllText($ReportPath, $json, (New-Object Text.UTF8Encoding($false))) } else { $json }
