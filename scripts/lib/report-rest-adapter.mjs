/* Supabase REST boundary for the report generator.
 * The public anonymous key is read from the existing application config; all
 * report-specific authorization and transport policy remains in reportRead. */
export function createReportRestAdapter({read, reportRead}) {
  const source = read('src/config/supabase.js');
  const SB = {
    url: source.match(/SB_URL="([^"]+)"/)[1],
    key: source.match(/SB_KEY="([^"]+)"/)[1],
  };
  async function rest(table, params) {
    const url = SB.url + '/rest/v1/' + table + '?' + new URLSearchParams(params);
    const response = await reportRead(url, {
      headers: {
        apikey: SB.key,
        Authorization: 'Bearer ' + SB.key,
      },
    });
    if (!response.ok) throw new Error(table + ' HTTP ' + response.status);
    return response.json();
  }
  return {rest};
}
