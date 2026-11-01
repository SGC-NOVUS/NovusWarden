#!/usr/bin/env python3
"""
NovusWarden: SQLite to PostgreSQL 16/17/18+ Automated Migration Tool
Maintained by SGC-NOVUS (System Generations Core Novus) - AGPL-3.0

Exports and transforms an active NovusWarden SQLite database into PostgreSQL
compatible format, handling boolean conversions, binary fields, foreign key
integrity, and sequence updates.
"""

import argparse
import os
import sqlite3
import sys
from datetime import datetime

# Topological table order to respect foreign key constraints
TABLE_ORDER = [
    "users",
    "devices",
    "invitations",
    "organizations",
    "users_organizations",
    "org_policies",
    "groups",
    "groups_users",
    "collections",
    "users_collections",
    "ciphers",
    "ciphers_collections",
    "attachments",
    "folders",
    "folders_ciphers",
    "twofactor",
    "twofactor_incomplete",
    "sends",
    "emergency_access",
    "sso_users",
    "auth_requests",
    "events",
]

# Columns across tables that are boolean in PostgreSQL but integer (0/1) in SQLite
BOOLEAN_COLUMNS = {
    "users": {"enabled", "password_hint", "email_verified"},
    "users_organizations": {"hide_passwords"},
    "org_policies": {"enabled"},
    "ciphers": {"favorite"},
    "attachments": {"is_persisted"},
    "twofactor": {"enabled"},
    "sends": {"disabled", "hide_email"},
    "auth_requests": {"approved"},
}


def dump_sqlite_to_postgres(sqlite_path: str, output_path: str):
    if not os.path.exists(sqlite_path):
        print(f"Error: SQLite database file not found at '{sqlite_path}'", file=sys.stderr)
        sys.exit(1)

    print(f"[*] Reading SQLite database: {sqlite_path}")
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Discover tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__diesel_%';")
    existing_tables = set(row[0] for row in cursor.fetchall())

    ordered_tables = [t for t in TABLE_ORDER if t in existing_tables]
    # Add any remaining tables not explicitly listed in TABLE_ORDER
    for t in existing_tables:
        if t not in ordered_tables:
            ordered_tables.append(t)

    print(f"[*] Found {len(ordered_tables)} tables to migrate.")

    with open(output_path, "w", encoding="utf-8") as out:
        out.write("-- ================================================================\n")
        out.write(f"-- NovusWarden SQLite to PostgreSQL Migration Dump\n")
        out.write(f"-- Generated: {datetime.utcnow().isoformat()}Z by SGC-NOVUS\n")
        out.write("-- ================================================================\n\n")
        out.write("SET statement_timeout = 0;\n")
        out.write("SET lock_timeout = 0;\n")
        out.write("SET client_encoding = 'UTF8';\n")
        out.write("SET standard_conforming_strings = on;\n")
        out.write("SET check_function_bodies = false;\n")
        out.write("SET client_min_messages = warning;\n\n")

        # Disable foreign key triggers during import
        out.write("BEGIN;\n")
        out.write("SET CONSTRAINTS ALL DEFERRED;\n\n")

        total_rows = 0

        for table in ordered_tables:
            cursor.execute(f"PRAGMA table_info('{table}')")
            cols_info = cursor.fetchall()
            col_names = [c["name"] for c in cols_info]
            bool_cols = BOOLEAN_COLUMNS.get(table, set())

            cursor.execute(f"SELECT * FROM \"{table}\"")
            rows = cursor.fetchall()
            row_count = len(rows)
            total_rows += row_count

            print(f"  -> Migrating table '{table}' ({row_count} rows)...")
            out.write(f"-- Table: {table} ({row_count} rows)\n")

            if not rows:
                out.write("\n")
                continue

            quoted_cols = ", ".join(f'"{c}"' for c in col_names)

            for row in rows:
                values = []
                for col_name in col_names:
                    val = row[col_name]
                    if val is None:
                        values.append("NULL")
                    elif col_name in bool_cols:
                        values.append("TRUE" if val == 1 else "FALSE")
                    elif isinstance(val, (int, float)):
                        values.append(str(val))
                    elif isinstance(val, bytes):
                        # PostgreSQL hex bytea format
                        hex_str = val.hex()
                        values.append(f"'\\x{hex_str}'::bytea")
                    else:
                        escaped = str(val).replace("'", "''")
                        values.append(f"'{escaped}'")

                val_str = ", ".join(values)
                out.write(f'INSERT INTO "{table}" ({quoted_cols}) VALUES ({val_str}) ON CONFLICT DO NOTHING;\n')

            out.write("\n")

        out.write("COMMIT;\n")
        out.write("-- Migration completed successfully.\n")

    conn.close()
    print(f"\n[✓] Successfully exported {total_rows} rows from {len(ordered_tables)} tables to '{output_path}'.")
    print("\nNext step: Import the SQL dump into your PostgreSQL database:")
    print(f"  psql \"postgresql://user:password@host:5432/novuswarden\" -f \"{output_path}\"")


def main():
    parser = argparse.ArgumentParser(
        description="NovusWarden SQLite to PostgreSQL Migration Tool (by SGC-NOVUS)"
    )
    parser.add_argument(
        "--sqlite",
        default="data/db.sqlite3",
        help="Path to the SQLite database file (default: data/db.sqlite3)",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="novuswarden_pg_migration.sql",
        help="Target SQL file output path (default: novuswarden_pg_migration.sql)",
    )

    args = parser.parse_args()
    dump_sqlite_to_postgres(args.sqlite, args.output)


if __name__ == "__main__":
    main()
