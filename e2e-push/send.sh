#!/usr/bin/env bash
# Deliver a real-format APNs payload to the booted iOS simulator (no APNs credentials needed): ./e2e-push/send.sh lab-critical
# Types: lab-critical | sos | order-received | upgrade-request. Requires the dev build (com.kiorly.team) installed.
set -euo pipefail
cd "$(dirname "$0")"
xcrun simctl push booted com.kiorly.team "${1:?usage: send.sh <lab-critical|sos|order-received|upgrade-request>}.json"
