import { getCapabilityMatrix, type CapabilityTrack } from '@/lib/capability-matrix';
import type { Locale } from '@/lib/i18n';

type CapabilityStatusTablesProps = {
  locale: Locale;
  track: CapabilityTrack;
};

export function CapabilityStatusTables({ locale, track }: CapabilityStatusTablesProps) {
  const matrix = getCapabilityMatrix(locale, track);

  return (
    <>
      <h2>{matrix.scope.heading}</h2>
      <table>
        <thead>
          <tr>
            <th>{matrix.scope.columns.area}</th>
            <th>{matrix.scope.columns.included}</th>
            <th>{matrix.scope.columns.status}</th>
            <th>{matrix.scope.columns.notes}</th>
          </tr>
        </thead>
        <tbody>
          {matrix.scope.rows.map((row) => (
            <tr key={row.area}>
              <td>{row.area}</td>
              <td>{row.included}</td>
              <td>{row.status}</td>
              <td>{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{matrix.delivery.heading}</h2>
      <table>
        <thead>
          <tr>
            <th>{matrix.delivery.columns.capability}</th>
            <th>{matrix.delivery.columns.provided}</th>
            <th>{matrix.delivery.columns.completion}</th>
            <th>{matrix.delivery.columns.validation}</th>
          </tr>
        </thead>
        <tbody>
          {matrix.delivery.rows.map((row) => (
            <tr key={row.capability}>
              <td>{row.capability}</td>
              <td>{row.provided}</td>
              <td>{row.completion}</td>
              <td>{row.validation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
