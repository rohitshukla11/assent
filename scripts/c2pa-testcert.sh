#!/bin/sh
# Generates a TEST C2PA signing chain: a local root CA and an ES256 leaf for "Assent render service
# (TEST)", organisation "Assent (test only)". It is not on any C2PA trust list, so validators report the
# signer as untrusted; that is expected and the verifier page says so. Output goes to .secrets/c2pa
# (git-ignored), never committed. Each signed file carries its chain, so files signed with an earlier
# chain keep verifying after a rotation.
#
#   sh scripts/c2pa-testcert.sh            # once; re-running keeps an existing chain
#   sh scripts/c2pa-testcert.sh --rotate   # a new chain; the current one moves to $dir/previous-<time>/
# C2PA_NAME / C2PA_ORG override the names (the tests make a chain with the earlier "Likeness" names).
set -eu
dir="${C2PA_DIR:-.secrets/c2pa}"
name="${C2PA_NAME:-Assent}"
org="${C2PA_ORG:-Assent (test only)}"
if [ -f "$dir/signer.pem" ] && [ -f "$dir/signer.key" ]; then
  if [ "${1:-}" != "--rotate" ]; then
    echo "C2PA test chain already present in $dir"
    exit 0
  fi
  prev="$dir/previous-$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$prev" && chmod 700 "$prev"
  mv "$dir/signer.pem" "$dir/signer.key" "$prev/"
  [ -f "$dir/ca.pem" ] && mv "$dir/ca.pem" "$prev/"
  echo "previous chain kept in $prev"
fi
mkdir -p "$dir"
chmod 700 "$dir"
cd "$dir"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

cat >"$tmp/ca.ext" <<'EOF'
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
EOF
# C2PA signer profile: not a CA, digitalSignature only, an allowed EKU (emailProtection), and an
# authority key id chaining it to the CA. https://spec.c2pa.org/specifications/specifications/2.2/specs/C2PA_Specification.html#_certificate_profile
cat >"$tmp/leaf.ext" <<'EOF'
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature
extendedKeyUsage = emailProtection
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid
EOF

openssl ecparam -name prime256v1 -genkey -noout -out "$tmp/ca.key"
openssl req -new -key "$tmp/ca.key" -subj "/CN=$name TEST Root CA/O=$org" -out "$tmp/ca.csr"
openssl x509 -req -in "$tmp/ca.csr" -signkey "$tmp/ca.key" -days 3650 -sha256 -extfile "$tmp/ca.ext" -out ca.pem

openssl ecparam -name prime256v1 -genkey -noout -out "$tmp/leaf.key"
openssl pkcs8 -topk8 -nocrypt -in "$tmp/leaf.key" -out signer.key
openssl req -new -key "$tmp/leaf.key" -subj "/CN=$name render service (TEST)/O=$org" -out "$tmp/leaf.csr"
openssl x509 -req -in "$tmp/leaf.csr" -CA ca.pem -CAkey "$tmp/ca.key" -CAcreateserial -days 825 -sha256 -extfile "$tmp/leaf.ext" -out "$tmp/leaf.pem"
cat "$tmp/leaf.pem" ca.pem >signer.pem
rm -f ca.srl
chmod 600 signer.key
echo "C2PA test chain written to $dir (signer.pem = leaf + CA, signer.key = PKCS#8 ES256). The CA key was discarded."
