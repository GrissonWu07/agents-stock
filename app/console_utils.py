import builtins
import sys

ORIGINAL_PRINT = builtins.print


def configure_standard_streams():
    """Ensure stdout/stderr replace unsupported characters instead of crashing."""
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is None or not hasattr(stream, "reconfigure"):
            continue

        try:
            stream.reconfigure(errors="replace")
        except Exception:
            continue


def safe_print(*args, sep=" ", end="\n", file=None, flush=False):
    """Print without crashing when the console cannot encode emoji."""
    target = sys.stdout if file is None else file

    try:
        ORIGINAL_PRINT(*args, sep=sep, end=end, file=target, flush=flush)
    except UnicodeEncodeError:
        encoding = getattr(target, "encoding", None) or "utf-8"
        text = sep.join(str(arg) for arg in args)
        sanitized = text.encode(encoding, errors="replace").decode(encoding, errors="replace")
        target.write(sanitized + end)
        if flush and hasattr(target, "flush"):
            target.flush()


def install_safe_print():
    """Patch builtins.print so all modules get Unicode-safe console logging."""
    if builtins.print is not safe_print:
        builtins.print = safe_print
