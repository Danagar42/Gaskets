#!/usr/bin/env python3
"""Validate standards JSON files and build the offline browser bundle."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "standards"
OUTPUT = ROOT / "standards.bundle.js"


def validate_washer(record, filename):
    if record.get("unit") != "mm":
        raise ValueError(f"{filename}: only explicit millimetre dimensions are supported")
    if record.get("id") != filename.stem:
        raise ValueError(f"{filename}: id must equal filename")
    if not record.get("document") or not record.get("source", {}).get("url"):
        raise ValueError(f"{filename}: standard designation and source URL are required")
    if not record.get("sizes"):
        raise ValueError(f"{filename}: sizes must not be empty")
    valid_classes = set(record.get("accuracyClasses", []))
    for execution, classes in record.get("executions", {}).items():
        if not set(classes).issubset(valid_classes):
            raise ValueError(f"{filename}: invalid accuracy classes for execution {execution}")
        if execution not in record.get("minDiameterByExecutionMm", {}):
            raise ValueError(f"{filename}: missing minimum diameter for execution {execution}")
    for d, row in record["sizes"].items():
        nominal = float(d)
        if not math.isfinite(nominal) or nominal <= 0:
            raise ValueError(f"{filename}: invalid nominal diameter {d}")
        diameters = row.get("innerDiameterByClassMm", {})
        if set(diameters) != valid_classes:
            raise ValueError(f"{filename}: missing or unexpected accuracy class at M{d}")
        values = [row.get("outerDiameterMm"), row.get("thicknessMm"), *diameters.values()]
        if any(v is not None and (type(v) not in (int, float) or not math.isfinite(v) or v <= 0) for v in values):
            raise ValueError(f"{filename}: invalid numeric value at M{d}")
        if not isinstance(row.get("outerDiameterMm"), (int, float)) or not isinstance(row.get("thicknessMm"), (int, float)):
            raise ValueError(f"{filename}: outer diameter and thickness required for M{d}")
        if not isinstance(diameters.get("A"), (int, float)):
            raise ValueError(f"{filename}: A-class inner diameter required at M{d}")


def validate_nut(record, filename):
    if record.get("unit") != "mm":
        raise ValueError(f"{filename}: nut dimensions must use mm")
    if record.get("id") != filename.stem or not record.get("document"):
        raise ValueError(f"{filename}: standard id or document missing")
    if not record.get("source", {}).get("url"):
        raise ValueError(f"{filename}: source URL is required")
    if not record.get("sizes"):
        raise ValueError(f"{filename}: no nut sizes")
    for type_id, info in record.get("types", {}).items():
        if not type_id or not info.get("label") or not info.get("heightSymbol") or not info.get("heightLabel"):
            raise ValueError(f"{filename}: nut type metadata missing for {type_id}")
    diameters = set()
    for designation, row in record["sizes"].items():
        nominal = float(designation)
        if not math.isfinite(nominal) or nominal <= 0:
            raise ValueError(f"{filename}: invalid nominal diameter {designation}")
        if record.get("types"):
            kinds = record["types"]
            if set(row) != {"heightsByTypeMm"}:
                raise ValueError(f"{filename}: typed nut rows must hold only heightsByTypeMm at M{designation}")
            heights = row.get("heightsByTypeMm", {})
            if set(heights) != set(kinds):
                raise ValueError(f"{filename}: expected exact nut types {list(kinds)} at M{designation}")
            if not any(type(v) in (float, int) and math.isfinite(v) and v > 0 for v in heights.values()):
                raise ValueError(f"{filename}: no usable height at M{designation}")
            for type_id, height in heights.items():
                if height is not None and (type(height) not in (float, int) or not math.isfinite(height) or height <= 0):
                    raise ValueError(f"{filename}: invalid nut height for type {type_id} at M{designation}")
        else:
            height = row.get("heightMm")
            if type(height) not in (float, int) or not math.isfinite(height) or height <= 0:
                raise ValueError(f"{filename}: invalid nut height at M{designation}")
            if set(row) != {"heightMm"}:
                raise ValueError(f"{filename}: nut catalog stores only heightMm at M{designation}")
        diameters.add(nominal)
    nonpreferred = record.get("nonPreferredDiametersMm", [])
    if any(d not in diameters for d in nonpreferred) or len(set(nonpreferred)) != len(nonpreferred):
        raise ValueError(f"{filename}: nonpreferred list must reference distinct known sizes")


def validate_thread(record, filename):
    if record.get("unit") != "mm" or record.get("id") != filename.stem:
        raise ValueError(f"{filename}: wrong id or units")
    if not record.get("document") or not record.get("pitchDocument"):
        raise ValueError(f"{filename}: thread and pitch source documents required")
    if not record.get("source", {}).get("pitchUrl") or not record.get("source", {}).get("dimensionsUrl"):
        raise ValueError(f"{filename}: source URLs required")
    sizes = record.get("sizes", {})
    if not sizes:
        raise ValueError(f"{filename}: empty thread catalog")
    for nominal, row in sizes.items():
        d = float(nominal)
        if not math.isfinite(d) or d <= 0:
            raise ValueError(f"{filename}: invalid nominal diameter {nominal}")
        pitches = row.get("pitchesMm", [])
        if not pitches or any(type(p) not in (float, int) or not math.isfinite(p) or p <= 0 for p in pitches):
            raise ValueError(f"{filename}: invalid pitches at M{nominal}")
        if len(set(pitches)) != len(pitches) or pitches != sorted(pitches, reverse=True):
            raise ValueError(f"{filename}: pitches must be unique descending values at M{nominal}")
        coarse = row.get("coarsePitchMm")
        if coarse is not None and (type(coarse) not in (float, int) or coarse not in pitches):
            raise ValueError(f"{filename}: invalid coarse pitch for M{nominal}")
        nonpreferred = row.get("nonPreferredPitchesMm", [])
        if any(p not in pitches for p in nonpreferred):
            raise ValueError(f"{filename}: invalid nonpreferred pitch for M{nominal}")



def validate_gasket(record, filename):
    if record.get("id") != filename.stem or not record.get("name"):
        raise ValueError(f"{filename}: missing gasket identifier/name")
    source = record.get("source", {})
    if source.get("verificationStatus") == "screenshot_only":
        if source.get("documentId") is not None or record.get("document") is not None:
            raise ValueError(f"{filename}: unidentified TU must not claim an official number")
    elif not source.get("documentId"):
        raise ValueError(f"{filename}: confirmed TU must have a document identifier")
    for field in ("elasticModulusMPa", "seatingPressureMPa", "minimumPressureMPa", "maximumPressureMPa"):
        value = record.get(field)
        if type(value) not in (int, float) or not math.isfinite(value) or value <= 0:
            raise ValueError(f"{filename}: invalid {field}")
    if not (record["minimumPressureMPa"] <= record["seatingPressureMPa"] <= record["maximumPressureMPa"]):
        raise ValueError(f"{filename}: inconsistent pressures")
    width = record.get("effectiveWidth", {})
    if width.get("symbol") != "b" or width.get("rule") != "equalsSealingBandWidth":
        raise ValueError(f"{filename}: expected sealing-band width rule, not a constant")
    groups = record.get("mediumGroups", {})
    coefficients = record.get("mediumCoefficients", {})
    if not groups or set(groups) != set(coefficients):
        raise ValueError(f"{filename}: medium group mappings must match coefficients")
    labels = []
    for group, names in groups.items():
        coefficient = coefficients[group]
        if type(coefficient) not in (int, float) or not math.isfinite(coefficient) or coefficient <= 0:
            raise ValueError(f"{filename}: bad medium coefficient for {group}")
        if not names or any(not isinstance(name, str) or not name for name in names):
            raise ValueError(f"{filename}: invalid medium labels for {group}")
        labels.extend(names)
    if len(set(labels)) != len(labels):
        raise ValueError(f"{filename}: duplicate medium categories")
    values = record.get("expansionMicroPerCByTemperatureC", {})
    if not values or record.get("expansionTemperatureSelection") != "exact_only":
        raise ValueError(f"{filename}: alpha must use explicit table values with exact lookup")
    for temp, alpha in values.items():
        t = float(temp)
        if not math.isfinite(t) or type(alpha) not in (int, float) or not math.isfinite(alpha) or alpha <= 0:
            raise ValueError(f"{filename}: invalid expansion data at {temp}")
    if record.get("units", {}).get("expansion") != "10^-6/°C":
        raise ValueError(f"{filename}: expansion unit mismatch")


def main():
    catalog = {"version": 1, "washers": {}, "nuts": {}, "threads": {}, "gaskets": {}}
    for category, validate in (("washers", validate_washer), ("nuts", validate_nut), ("threads", validate_thread), ("gaskets", validate_gasket)):
        for filename in sorted((SOURCE / category).glob("*.json")):
            record = json.loads(filename.read_text(encoding="utf-8"))
            validate(record, filename)
            if record["id"] in catalog[category]:
                raise ValueError(f"Duplicate standard id: {record['id']}")
            catalog[category][record["id"]] = record
    body = json.dumps(catalog, ensure_ascii=False, separators=(",", ":"))
    OUTPUT.write_text(
        "// AUTO-GENERATED by scripts/build-standards.py; edit standards/**/*.json instead.\n"
        + "globalThis.FlangeStandardsDB = " + body + ";\n",
        encoding="utf-8",
    )
    print(f"Built {OUTPUT.name}: {len(catalog['washers'])} washers, {len(catalog['nuts'])} nuts, {len(catalog['threads'])} threads, {len(catalog['gaskets'])} gaskets")


if __name__ == "__main__":
    main()
