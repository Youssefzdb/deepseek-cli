#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "deepseek_hash.c"

int main(int argc, char **argv) {
    if (argc < 2) { fprintf(stderr, "Usage: solve_pow <challenge_hex> <prefix> <difficulty>\n"); return 1; }
    const char *chal_hex = argv[1];
    const char *prefix = argv[2];
    int diff = atoi(argv[3]);
    unsigned char chal_bytes[32], hash[32];
    for (int i = 0; i < 32; i++) {
        int hi = chal_hex[2*i], lo = chal_hex[2*i+1];
        chal_bytes[i] = ((hi >= 'a' ? hi - 'a' + 10 : hi - '0') << 4) | (lo >= 'a' ? lo - 'a' + 10 : lo - '0');
    }
    char input[1024];
    size_t plen = strlen(prefix);
    memcpy(input, prefix, plen);
    for (int nonce = 0; nonce < diff; nonce++) {
        int nlen = sprintf(input + plen, "%d", nonce);
        deepseek_hash_v1((unsigned char*)input, plen + nlen, hash);
        if (memcmp(hash, chal_bytes, 32) == 0) { printf("%d\n", nonce); return 0; }
    }
    fprintf(stderr, "PoW not found\n");
    return 1;
}
