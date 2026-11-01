#!/bin/sh

if [ -n "${UMASK}" ]; then
    umask "${UMASK}"
fi

if [ -r /etc/novuswarden.sh ]; then
    . /etc/novuswarden.sh
elif [ -r /etc/vaultwarden.sh ]; then
    . /etc/vaultwarden.sh
elif [ -r /etc/bitwarden_rs.sh ]; then
    echo "### You are using the old /etc/bitwarden_rs.sh script, please migrate to /etc/novuswarden.sh ###"
    . /etc/bitwarden_rs.sh
fi

if [ -d /etc/novuswarden.d ]; then
    for f in /etc/novuswarden.d/*.sh; do
        if [ -r "${f}" ]; then
            . "${f}"
        fi
    done
elif [ -d /etc/vaultwarden.d ]; then
    for f in /etc/vaultwarden.d/*.sh; do
        if [ -r "${f}" ]; then
            . "${f}"
        fi
    done
elif [ -d /etc/bitwarden_rs.d ]; then
    echo "### You are using the old /etc/bitwarden_rs.d script directory, please migrate to /etc/novuswarden.d ###"
    for f in /etc/bitwarden_rs.d/*.sh; do
        if [ -r "${f}" ]; then
            . "${f}"
        fi
    done
fi

if [ -x /novuswarden ]; then
    exec /novuswarden "${@}"
else
    exec /vaultwarden "${@}"
fi
