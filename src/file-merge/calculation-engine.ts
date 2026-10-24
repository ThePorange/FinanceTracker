/**
 * Calculation and Formula Evaluation Engine for File Merge.
 * Supports:
 * - Excel-style IF...THEN...ELSE conditional statements
 * - Basic arithmetic (+, -, *, /) and unary minus
 * - Comparison operators (=, ==, <>, !=, >, <, >=, <=)
 * - Field references (e.g., input.csv.debit, input.ofx.TRNAMT, sample.csv.debit, etc.)
 * - Special keywords: 'record', 'recordNumber', 'records', 'ofRecords'
 */

export interface EvalContext {
  csvRow?: Record<string, any>;
  ofxRow?: Record<string, any>;
  derivedCsv?: Record<string, any>;
  derivedOfx?: Record<string, any>;
  currentVal?: any;
  recordNumber?: number;
  ofRecords?: number;
}

export function evaluateExpression(expression: string, context: EvalContext): any {
  if (!expression || typeof expression !== 'string') {
    return context.currentVal !== undefined ? context.currentVal : '';
  }

  const trimmed = expression.trim();
  if (!trimmed) return context.currentVal !== undefined ? context.currentVal : '';

  const lower = trimmed.toLowerCase();

  // Special de-duplication keywords
  if (lower === 'record' || lower === 'recordnumber') {
    return context.recordNumber ?? 1;
  }
  if (lower === 'records' || lower === 'ofrecords') {
    return context.ofRecords ?? 1;
  }

  // Handle IF THEN ELSE
  // Syntax: IF <condition> THEN <trueExpr> [ELSE <falseExpr>]
  const ifRegex = /^IF\s+([\s\S]+?)\s+THEN\s+([\s\S]+?)(?:\s+ELSE\s+([\s\S]+))?$/i;
  const ifMatch = trimmed.match(ifRegex);
  if (ifMatch) {
    const condStr = ifMatch[1].trim();
    const thenStr = ifMatch[2].trim();
    const elseStr = ifMatch[3] ? ifMatch[3].trim() : '""';

    const condResult = evaluateCondition(condStr, context);
    if (condResult) {
      return evaluateExpression(thenStr, context);
    } else {
      return evaluateExpression(elseStr, context);
    }
  }

  // Simple string literal: "something" or 'something'
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Simple arithmetic / field resolution
  return evaluateArithmeticOrField(trimmed, context);
}

function evaluateCondition(condStr: string, context: EvalContext): boolean {
  // Regex to match operators: <>, !=, <=, >=, =, ==, <, >
  const opRegex = /(<>|!=|<=|>=|==|=|<|>)/;
  const parts = condStr.split(opRegex);
  if (parts.length >= 3) {
    const leftExpr = parts[0].trim();
    const op = parts[1].trim();
    const rightExpr = parts.slice(2).join('').trim();

    const leftVal = evaluateArithmeticOrField(leftExpr, context);
    const rightVal = evaluateArithmeticOrField(rightExpr, context);

    return compareValues(leftVal, op, rightVal);
  }

  // Truthy check if no operator
  const val = evaluateArithmeticOrField(condStr, context);
  if (typeof val === 'boolean') return val;
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return val !== 0;
  return true;
}

function compareValues(left: any, op: string, right: any): boolean {
  const normalize = (v: any) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    }
    return v;
  };

  const l = normalize(left);
  const r = normalize(right);

  // Numeric comparison if both look like numbers
  const isNumeric = (val: any) => {
    if (typeof val === 'number') return true;
    if (typeof val !== 'string' || val.trim() === '') return false;
    return !isNaN(Number(val));
  };

  if (isNumeric(l) && isNumeric(r)) {
    const numL = Number(l);
    const numR = Number(r);
    switch (op) {
      case '=':
      case '==':
        return numL === numR;
      case '<>':
      case '!=':
        return numL !== numR;
      case '>':
        return numL > numR;
      case '<':
        return numL < numR;
      case '>=':
        return numL >= numR;
      case '<=':
        return numL <= numR;
    }
  }

  // String / equality comparison
  const strL = String(l).toLowerCase();
  const strR = String(r).toLowerCase();

  switch (op) {
    case '=':
    case '==':
      return strL === strR;
    case '<>':
    case '!=':
      return strL !== strR;
    case '>':
      return strL > strR;
    case '<':
      return strL < strR;
    case '>=':
      return strL >= strR;
    case '<=':
      return strL <= strR;
    default:
      return false;
  }
}

function evaluateArithmeticOrField(expr: string, context: EvalContext): any {
  const trimmed = expr.trim();

  // String literal
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Standalone number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  // Check arithmetic operators (+, -, *, /)
  // Be careful not to break negative numbers or decimal points.
  // Match binary operators: expr1 * expr2, expr1 + expr2, etc.
  const binaryOpRegex = /^(.*?[^\s*\/+-])\s*([\*\/+-])\s*(.*)$/;
  const match = trimmed.match(binaryOpRegex);
  if (match) {
    const leftPart = match[1].trim();
    const op = match[2];
    const rightPart = match[3].trim();

    const leftVal = evaluateArithmeticOrField(leftPart, context);
    const rightVal = evaluateArithmeticOrField(rightPart, context);

    const numL = Number(leftVal);
    const numR = Number(rightVal);

    if (!isNaN(numL) && !isNaN(numR)) {
      switch (op) {
        case '*': return numL * numR;
        case '/': return numR !== 0 ? numL / numR : 0;
        case '+': return numL + numR;
        case '-': return numL - numR;
      }
    }
  }

  // Unary minus (e.g. -field or -5)
  if (trimmed.startsWith('-') && trimmed.length > 1) {
    const subVal = evaluateArithmeticOrField(trimmed.slice(1).trim(), context);
    const num = Number(subVal);
    return isNaN(num) ? subVal : -num;
  }

  // Resolve field reference
  return resolveField(trimmed, context);
}

function resolveField(ref: string, context: EvalContext): any {
  const cleanRef = ref.trim().replace(/^\[|\]$/g, '');

  // Look for currentVal if expression refers to source file itself (e.g. sample.ofx * -1 or input.ofx * -1)
  if (cleanRef.toLowerCase() === 'sample.ofx' || cleanRef.toLowerCase() === 'input.ofx' ||
      cleanRef.toLowerCase() === 'sample.csv' || cleanRef.toLowerCase() === 'input.csv') {
    if (context.currentVal !== undefined && context.currentVal !== '') {
      return context.currentVal;
    }
  }

  // Extract source prefix if present (e.g. input.csv.debit -> target source: csv, target field: debit)
  const parts = cleanRef.split('.');
  let targetField = cleanRef;
  let targetSource = '';

  if (parts.length >= 2) {
    const firstPart = parts[0].toLowerCase();
    if (firstPart === 'input' || firstPart === 'sample' || firstPart === 'derived') {
      const secondPart = parts[1].toLowerCase();
      if (secondPart === 'csv' || secondPart === 'ofx') {
        targetSource = `${firstPart}.${secondPart}`;
        targetField = parts.slice(2).join('.');
      } else {
        targetSource = firstPart;
        targetField = parts.slice(1).join('.');
      }
    } else if (firstPart === 'csv' || firstPart === 'ofx') {
      targetSource = firstPart;
      targetField = parts.slice(1).join('.');
    }
  }

  const lookupInObject = (obj?: Record<string, any>, key?: string): any => {
    if (!obj || !key) return undefined;
    if (obj[key] !== undefined) return obj[key];
    const lowerKey = key.toLowerCase();
    for (const k of Object.keys(obj)) {
      if (k.toLowerCase() === lowerKey) return obj[k];
    }
    return undefined;
  };

  // If specific source is specified:
  if (targetSource.includes('ofx')) {
    const derivedVal = lookupInObject(context.derivedOfx, targetField);
    if (derivedVal !== undefined) return derivedVal;
    const ofxVal = lookupInObject(context.ofxRow, targetField);
    if (ofxVal !== undefined) return ofxVal;
  }

  if (targetSource.includes('csv')) {
    const derivedVal = lookupInObject(context.derivedCsv, targetField);
    if (derivedVal !== undefined) return derivedVal;
    const csvVal = lookupInObject(context.csvRow, targetField);
    if (csvVal !== undefined) return csvVal;
  }

  // General search across context objects
  const foundInDerivedCsv = lookupInObject(context.derivedCsv, targetField);
  if (foundInDerivedCsv !== undefined) return foundInDerivedCsv;

  const foundInDerivedOfx = lookupInObject(context.derivedOfx, targetField);
  if (foundInDerivedOfx !== undefined) return foundInDerivedOfx;

  const foundInCsv = lookupInObject(context.csvRow, targetField);
  if (foundInCsv !== undefined) return foundInCsv;

  const foundInOfx = lookupInObject(context.ofxRow, targetField);
  if (foundInOfx !== undefined) return foundInOfx;

  if (context.currentVal !== undefined) return context.currentVal;

  return '';
}
