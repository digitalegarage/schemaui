import type { JsonValue, UiAst, UiNode, UiNodeKind, UiVariant } from "./types";
import {
  deepClone,
  getPointerValue,
  setPointerValue,
  splitPointer,
} from "./utils/jsonPointer";
import { materializeVariantNode } from "./utils/schemaToUiKind";
import {
  extractSchemaProperties,
  identifyVariantType,
} from "./utils/variantHelpers";
import { VARIANT_CONFIGS } from "./constants/variantDefaults";

export function applyUiDefaults(
  ast: UiAst | undefined,
  data: JsonValue,
): JsonValue {
  if (!ast) return ensureObjectRoot(data);

  let result = ensureObjectRoot(data);
  const seedRequired = (node: UiNode) => {
    let current = getPointerValue(result, node.pointer);
    if (node.pointer && current === undefined) {
      if (!node.required) return;
      const fallback = node.default_value ?? defaultForKind(node.kind);
      result = setPointerValue(result, node.pointer, deepClone(fallback));
      current = getPointerValue(result, node.pointer);
    }
    if (
      node.kind.type === "object" && current !== null &&
      typeof current === "object" && !Array.isArray(current)
    ) {
      node.kind.children.forEach(seedRequired);
    }
  };
  ast.roots.forEach(seedRequired);
  return result;
}

export function variantDefault(variant: UiVariant): JsonValue {
  const variantNode = materializeVariantNode(variant);

  // For object variants, use configurable variant identification
  if (variantNode.type === "object") {
    const result: Record<string, JsonValue> = {};

    // First, set any const fields from the schema to ensure unique identification
    const schemaProperties = extractSchemaProperties(variant.schema);

    // Identify variant type using configuration
    const variantType = identifyVariantType(schemaProperties);
    const variantConfig = variantType ? VARIANT_CONFIGS[variantType] : null;

    // Process each child node
    for (const child of variantNode.children) {
      const key = splitPointer(child.pointer).at(-1) || "";
      if (!(key in result)) {
        const authored = authoredPropertyValue(
          schemaProperties[key],
          variant.schema,
        );
        if (authored !== undefined) {
          result[key] = deepClone(authored);
        } else if (variantConfig && key in variantConfig.defaults) {
          result[key] = variantConfig.defaults[key] as JsonValue;
        } else if (child.required || variantNode.required?.includes(key)) {
          result[key] = child.default_value ?? defaultForKind(child.kind);
        }
      }
    }

    // Ensure all required fields have values
    if (variantNode.required) {
      for (const requiredKey of variantNode.required) {
        if (!(requiredKey in result)) {
          const childNode = variantNode.children.find(
            (c) => splitPointer(c.pointer).at(-1) === requiredKey,
          );
          if (childNode) {
            result[requiredKey] = childNode.default_value ??
              defaultForKind(childNode.kind);
          }
        }
      }
    }

    return result;
  }

  // For array variants, add a sample element to distinguish between string[] and number[]
  if (variantNode.type === "array") {
    const itemDefault = defaultForKind(variantNode.item);
    return [itemDefault];
  }

  return defaultForKind(variantNode);
}

function authoredPropertyValue(
  property: unknown,
  schema: JsonValue,
): JsonValue | undefined {
  const seen = new Set<string>();
  while (property && typeof property === "object" && !Array.isArray(property)) {
    const fields = property as Record<string, JsonValue>;
    if (Object.hasOwn(fields, "const")) return fields.const;
    if (Object.hasOwn(fields, "default")) return fields.default;
    const ref = fields.$ref;
    if (typeof ref !== "string" || !ref.startsWith("#/") || seen.has(ref)) {
      break;
    }
    seen.add(ref);
    property = getPointerValue(schema, ref.slice(1));
  }
  return undefined;
}

export function defaultForKind(kind: UiNodeKind): JsonValue {
  switch (kind.type) {
    case "field": {
      if (kind.enum_values?.length) {
        return deepClone(kind.enum_values[0] as JsonValue);
      }
      if (kind.nullable) {
        return null;
      }
      if (kind.enum_options?.length) {
        return kind.enum_options[0] as JsonValue;
      }
      switch (kind.scalar) {
        case "integer":
        case "number":
          return 0;
        case "boolean":
          return false;
        case "string":
        default:
          return "";
      }
    }
    case "array":
      return [];
    case "key_value":
      return {};
    case "object":
      return {};
    case "composite":
      if (kind.allow_multiple) {
        return [];
      }
      if (kind.variants[0]) {
        return variantDefault(kind.variants[0]);
      }
      return {};
    default:
      return {};
  }
}

function ensureObjectRoot(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}
