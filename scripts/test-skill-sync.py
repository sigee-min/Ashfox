#!/usr/bin/env python3
"""Exercise the skill updater against a locally built release."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
import tempfile


sys.dont_write_bytecode = True
repo_root = Path(__file__).resolve().parents[1]
release_root = Path(sys.argv[1]).resolve() / "skills" / "ashfox"
module_path = repo_root / "skills" / "ashfox" / "scripts" / "sync.py"
spec = importlib.util.spec_from_file_location("ashfox_skill_sync", module_path)
if spec is None or spec.loader is None:
    raise RuntimeError("Could not load the ashfox skill sync module.")
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

descriptor_bytes = (release_root / "latest.json").read_bytes()
release, entries = sync.parse_descriptor(descriptor_bytes)
assert release

remote_files = {
    entry["url"]: (
        release_root / "files" / str(entry["path"])
    ).read_bytes()
    for entry in entries
}


def local_fetch(url: str, limit: int) -> bytes:
    data = remote_files[url]
    if len(data) > limit:
        raise sync.SyncError("fixture exceeds limit")
    return data


sync.fetch = local_fetch
downloaded = sync.download_release(entries)

with tempfile.TemporaryDirectory(prefix="ashfox-skill-sync-") as directory:
    installed = Path(directory)
    for relative in sync.ALLOWED_PATHS:
        target = installed / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"outdated")
    sync.apply_release(installed, downloaded)
    for relative in sync.ALLOWED_PATHS:
        assert (installed / relative).read_bytes() == downloaded[relative]

with tempfile.TemporaryDirectory(prefix="ashfox-portable-skill-sync-") as directory:
    portable = Path(directory)
    for relative in sync.CORE_PATHS:
        target = portable / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"outdated")
    active_paths = sync.installed_paths(portable)
    assert active_paths == sync.CORE_PATHS
    portable_download = sync.download_release(entries, active_paths)
    sync.apply_release(portable, portable_download)
    assert not (portable / "agents" / "openai.yaml").exists()
    for relative in sync.CORE_PATHS:
        assert (portable / relative).read_bytes() == portable_download[relative]

tampered = json.loads(descriptor_bytes)
tampered["files"][0]["sha256"] = "0" * 64
try:
    sync.download_release(tampered["files"])
except sync.SyncError:
    pass
else:
    raise AssertionError("A tampered release was accepted.")

print("ashfox skill sync simulation ok")
