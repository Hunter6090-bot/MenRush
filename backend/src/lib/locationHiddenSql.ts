/**
 * "Hide my location from" SQL fragments.
 *
 * `ownerExpr` is the member whose location may be hidden (e.g. `u.id`),
 * `viewerExpr` is the person looking (e.g. `$3`). True when the owner has put
 * the viewer on their hide list. Used inside WHERE / CASE so the viewer's
 * response is shaped exactly like any other "not nearby / no distance" case.
 */
export function locationHiddenFromViewerSql(ownerExpr: string, viewerExpr: string): string {
  return `EXISTS (
          SELECT 1 FROM location_hidden_from lh
          WHERE lh.owner_id = ${ownerExpr} AND lh.hidden_user_id = ${viewerExpr}
        )`;
}

export function notLocationHiddenFromViewerSql(ownerExpr: string, viewerExpr: string): string {
  return `NOT ${locationHiddenFromViewerSql(ownerExpr, viewerExpr)}`;
}
