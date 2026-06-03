#!/usr/bin/env python3
"""PoW solver — called by Node.js via child_process"""
import sys, ctypes, os

SO_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "deepseek_hash.so")
lib = ctypes.CDLL(SO_PATH)

def solve(challenge_hex, prefix, difficulty):
    chal_bytes = bytes.fromhex(challenge_hex)
    for nonce in range(int(difficulty)):
        full = (prefix + str(nonce)).encode()
        out = (ctypes.c_ubyte * 32)()
        lib.deepseek_hash_v1(full, len(full), out)
        if bytes(out) == chal_bytes:
            return nonce
    raise ValueError("PoW not found")

if __name__ == "__main__":
    # Usage: python3 solve_pow.py <challenge_hex> <prefix> <difficulty>
    chal = sys.argv[1]
    prefix = sys.argv[2]
    diff = int(sys.argv[3])
    nonce = solve(chal, prefix, diff)
    print(nonce)
