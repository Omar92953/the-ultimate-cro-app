/**
 * The size chart as a table to fill in (Size guide → Size chart): column names along the top, one row per size.
 * Scrolls sideways when there are many columns; each column and size has its own remove button.
 */
import { MAX_COLUMNS, MAX_ROWS, type Chart } from "../lib/size-guide";
import { Button, TextField } from "./fields";
import styles from "./SizeChartTable.module.css";

export function SizeChartTable({ chart, setChart }: { chart: Chart; setChart: (patch: Partial<Chart>) => void }) {
  const cols = chart.columns;
  const setCol = (i: number, v: string) => setChart({ columns: cols.map((x, j) => (j === i ? v : x)) });
  const setCell = (r: number, c: number, v: string) => setChart({ rows: chart.rows.map((x, i) => (i === r ? { ...x, values: x.values.map((y, k) => (k === c ? v : y)) } : x)) });
  const setSize = (r: number, v: string) => setChart({ rows: chart.rows.map((x, i) => (i === r ? { ...x, size: v } : x)) });
  const addColumn = () => cols.length < MAX_COLUMNS && setChart({ columns: [...cols, ""], rows: chart.rows.map((r) => ({ ...r, values: [...r.values, ""] })) });
  const removeColumn = (i: number) => setChart({ columns: cols.filter((_, j) => j !== i), rows: chart.rows.map((r) => ({ ...r, values: r.values.filter((_, j) => j !== i) })) });
  const addRow = () => chart.rows.length < MAX_ROWS && setChart({ rows: [...chart.rows, { size: "", values: cols.map(() => ""), height: [null, null], weight: [null, null] }] });
  const removeRow = (i: number) => setChart({ rows: chart.rows.filter((_, j) => j !== i) });

  return (
    <s-stack gap="base">
      <div className={styles.scroll}>
        <div className={styles.table} style={{ gridTemplateColumns: `minmax(72px, 0.8fr) repeat(${cols.length}, minmax(96px, 1fr)) 36px` }} role="table" aria-label={`${chart.name} sizes`}>
          <div className={styles.head} role="row">
            <span className={styles.corner} role="columnheader">
              Size
            </span>
            {cols.map((col, i) => (
              <span key={i} className={styles.colHead} role="columnheader">
                <span className={styles.colTop}>
                  <span>Column {i + 1}</span>
                  {cols.length > 1 ? (
                    <button type="button" className={styles.x} aria-label={`Remove the ${col || `column ${i + 1}`} column`} title="Remove column" onClick={() => removeColumn(i)}>
                      ×
                    </button>
                  ) : null}
                </span>
                <TextField label={`Name of column ${i + 1}`} labelHidden placeholder="Chest" value={col} onValue={(v) => setCol(i, v)} />
              </span>
            ))}
            <span />
          </div>
          {chart.rows.map((r, i) => (
            <div key={i} className={styles.row} role="row">
              <span role="cell">
                <TextField label={`Size ${i + 1}`} labelHidden placeholder="M" value={r.size} onValue={(v) => setSize(i, v)} />
              </span>
              {cols.map((col, j) => (
                <span key={j} role="cell">
                  <TextField label={`${r.size || `Size ${i + 1}`}, ${col || `column ${j + 1}`}`} labelHidden placeholder="86 to 91" value={r.values[j] ?? ""} onValue={(v) => setCell(i, j, v)} />
                </span>
              ))}
              <span role="cell" className={styles.end}>
                <button type="button" className={styles.x} aria-label={`Remove size ${r.size || i + 1}`} title="Remove size" onClick={() => removeRow(i)}>
                  ×
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
      <s-stack direction="inline" gap="small-200">
        {chart.rows.length < MAX_ROWS ? <Button onClick={addRow}>Add a size</Button> : null}
        {cols.length < MAX_COLUMNS ? (
          <Button variant="tertiary" onClick={addColumn}>
            Add a column
          </Button>
        ) : null}
      </s-stack>
    </s-stack>
  );
}
