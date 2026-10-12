import { describe, expect, it } from "vitest";
import type { JsonValue, UiAst, UiNode } from "./types";
import { applyUiDefaults, variantDefault } from "./ui-ast";

const field = (pointer: string, required = false): UiNode => ({
  pointer,
  required,
  default_value: "seed",
  kind: { type: "field", scalar: "string" },
});
const object: UiNode = {
  pointer: "/optional",
  required: false,
  default_value: {},
  kind: {
    type: "object",
    required: ["requiredChild"],
    children: [
      field("/optional/requiredChild", true),
      field("/optional/absentChild"),
    ],
  },
};
const ast: UiAst = {
  roots: [object, field("/nullable"), field("/required", true)],
};

describe("config preservation", () => {
  it("leaves absent optional parents and descendants absent", () => {
    expect(applyUiDefaults(ast, {})).toEqual({ required: "seed" });
  });
  it("does not fill absent optional descendants of a present object", () => {
    expect(
      applyUiDefaults(ast, {
        optional: { requiredChild: "set", untouched: false },
      }),
    )
      .toEqual({
        optional: { requiredChild: "set", untouched: false },
        required: "seed",
      });
  });
  it.each(([null, false, 0, "", []] as JsonValue[]).map((value) => [value]))(
    "preserves a present parent value %j",
    (value) => {
      expect(
        applyUiDefaults(ast, {
          optional: value,
          nullable: null,
          required: "set",
        }),
      )
        .toEqual({ optional: value, nullable: null, required: "set" });
    },
  );
  it("seeds absent required children only inside a present object", () => {
    expect(applyUiDefaults(ast, { optional: {} })).toEqual({
      optional: { requiredChild: "seed" },
      required: "seed",
    });
  });
});

it("seeds a new object variant from required fields and authored defaults only", () => {
  const value = variantDefault({
    id: "object",
    is_object: true,
    schema: {
      type: "object",
      properties: {
        required: { type: "string" },
        optionalUrl: { type: "string" },
        nested: { type: "object" },
        enabled: { type: "boolean", default: false },
        nullable: { type: ["string", "null"], default: null },
        "slash/key": { type: "string", default: "authored" },
      },
      required: ["required"],
    },
    node: {
      type: "object",
      required: ["required"],
      children: [
        field("/required", true),
        field("/optionalUrl"),
        {
          pointer: "/nested",
          required: false,
          default_value: {},
          kind: { type: "object", children: [], required: [] },
        },
        { ...field("/enabled"), default_value: false },
        { ...field("/nullable"), default_value: null },
        field("/slash~1key"),
      ],
    },
  });
  expect(value).toEqual({
    required: "seed",
    enabled: false,
    nullable: null,
    "slash/key": "authored",
  });
});

it("preserves property-level referenced authored defaults, including null and false", () => {
  expect(variantDefault({
    id: "refs",
    is_object: true,
    schema: {
      type: "object",
      properties: {
        name: { $ref: "#/$defs/name" },
        nullable: { $ref: "#/$defs/nullable" },
        flag: { $ref: "#/$defs/flag" },
      },
      $defs: {
        name: { type: "string", default: "authored" },
        nullable: { type: ["string", "null"], default: null },
        flag: { type: "boolean", default: false },
      },
    },
    node: {
      type: "object",
      required: [],
      children: [field("/name"), field("/nullable"), field("/flag")],
    },
  })).toEqual({ name: "authored", nullable: null, flag: false });
});
