const SHORT_ALIASES = {
  h: "help",
  j: "json",
  v: "version",
};

function toOptionName(raw) {
  return raw.replace(/^-+/, "");
}

function addOption(target, key, value) {
  if (Object.prototype.hasOwnProperty.call(target, key)) {
    const current = target[key];
    target[key] = Array.isArray(current) ? [...current, value] : [current, value];
    return;
  }
  target[key] = value;
}

export function parseArgs(argv) {
  const options = {};
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--") {
      positionals.push(...argv.slice(index + 1));
      break;
    }

    if (token.startsWith("--")) {
      if (token.startsWith("--no-")) {
        addOption(options, toOptionName(token.slice(5)), false);
        continue;
      }

      const equalsIndex = token.indexOf("=");
      if (equalsIndex !== -1) {
        addOption(
          options,
          toOptionName(token.slice(2, equalsIndex)),
          token.slice(equalsIndex + 1),
        );
        continue;
      }

      const key = toOptionName(token.slice(2));
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith("-")) {
        addOption(options, key, next);
        index += 1;
      } else {
        addOption(options, key, true);
      }
      continue;
    }

    if (token.startsWith("-") && token.length > 1) {
      const flags = token.slice(1).split("");
      for (const flag of flags) {
        const key = SHORT_ALIASES[flag];
        if (!key) {
          throw new Error(`Unknown short option: -${flag}`);
        }
        addOption(options, key, true);
      }
      continue;
    }

    positionals.push(token);
  }

  return { options, positionals };
}
