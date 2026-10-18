/**
 * Run a MySQL/MariaDB client tool (mysql, mysqldump, mariadb, mariadb-dump) inside its container
 * without putting the password on any command line. Credentials are read from the container's
 * own environment and handed over through a temporary defaults file written by the shell
 * builtin printf. By default root is used when a root password is configured (dumps and
 * restores need its privileges); otherwise, or with preferRoot: false, the application user.
 *
 * Returns the argv to place after `docker compose exec -T <service>`.
 */
export function mysqlClientCommand(tool: string, args: string[], options: { preferRoot?: boolean } = {}): string[] {
  const root = 'U=root; P="${MARIADB_ROOT_PASSWORD:-${MYSQL_ROOT_PASSWORD:-}}"';
  const app = 'U="${MARIADB_USER:-${MYSQL_USER:-}}"; P="${MARIADB_PASSWORD:-${MYSQL_PASSWORD:-}}"';
  const [first, fallback] = options.preferRoot === false ? [app, root] : [root, app];
  const script = [
    `${first}`,
    `if [ -z "$U" ] || [ -z "$P" ]; then ${fallback}; fi`,
    '[ -n "$U" ] || U=root',
    'f=$(mktemp)',
    'trap \'rm -f "$f"\' EXIT',
    'printf \'[client]\\nuser=%s\\npassword=%s\\n\' "$U" "$P" > "$f"',
    '"$0" --defaults-extra-file="$f" "$@"',
  ].join('\n');
  return ['sh', '-c', script, tool, ...args];
}
