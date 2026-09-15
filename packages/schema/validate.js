'use strict';

/**
 * GBE JSON Schema 子集校验器 —— 零依赖。
 *
 * 为什么不用 ajv：
 *   1. 离线可用（本仓与 studio 都必须能无网络跑 CI）；
 *   2. 无供应链面（一个 npm 包换来整个校验链的信任成本不划算）；
 *   3. 支持的子集是【刻意收窄】的——本仓所有 schema 只使用下列关键字，
 *      校验行为完全可预测。若将来需要更多关键字，在此一次性扩展。
 *
 * 支持的关键字：
 *   type / const / enum
 *   minimum / maximum / exclusiveMinimum / exclusiveMaximum
 *   minLength / maxLength / pattern / format(date-time)
 *   minItems / maxItems / uniqueItems / items
 *   required / properties / additionalProperties(bool|schema)
 *   allOf / anyOf / oneOf / not
 * 忽略：$schema / $id / title / description / $comment（注释性）
 */

const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

function jsonType(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v; // string | boolean | object | undefined | function
}

function typeMatches(expected, value) {
  const actual = jsonType(value);
  if (expected === actual) return true;
  // JSON Schema 语义：integer 属于 number
  if (expected === 'number' && actual === 'integer') return true;
  return false;
}

function stable(v) {
  return JSON.stringify(v);
}

function validateNode(schema, data, ptr, errors) {
  if (schema === undefined || schema === true) return;
  if (schema === false) {
    errors.push({ path: ptr, message: '此处不允许出现任何值（schema = false）' });
    return;
  }
  if (typeof schema !== 'object' || schema === null) return;

  // ---- type ----
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(t, data))) {
      errors.push({
        path: ptr,
        message: `类型应为 ${types.join(' | ')}，实际为 ${jsonType(data)}`,
      });
      return; // 类型不符后其余断言无意义
    }
  }

  // ---- const / enum ----
  if (schema.const !== undefined && stable(data) !== stable(schema.const)) {
    errors.push({ path: ptr, message: `必须恒等于 ${stable(schema.const)}，实际为 ${stable(data)}` });
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => stable(e) === stable(data))) {
    errors.push({
      path: ptr,
      message: `取值必须属于 ${stable(schema.enum)}，实际为 ${stable(data)}`,
    });
  }

  // ---- number ----
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({ path: ptr, message: `不得小于 ${schema.minimum}（实际 ${data}）` });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({ path: ptr, message: `不得大于 ${schema.maximum}（实际 ${data}）` });
    }
    if (schema.exclusiveMinimum !== undefined && data <= schema.exclusiveMinimum) {
      errors.push({ path: ptr, message: `必须大于 ${schema.exclusiveMinimum}（实际 ${data}）` });
    }
    if (schema.exclusiveMaximum !== undefined && data >= schema.exclusiveMaximum) {
      errors.push({ path: ptr, message: `必须小于 ${schema.exclusiveMaximum}（实际 ${data}）` });
    }
  }

  // ---- string ----
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({ path: ptr, message: `长度不得少于 ${schema.minLength}（实际 ${data.length}）` });
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({ path: ptr, message: `长度不得超过 ${schema.maxLength}（实际 ${data.length}）` });
    }
    if (schema.pattern !== undefined) {
      let re;
      try {
        re = new RegExp(schema.pattern);
      } catch (e) {
        errors.push({ path: ptr, message: `schema 中的 pattern 非法：${schema.pattern}` });
      }
      if (re && !re.test(data)) {
        errors.push({ path: ptr, message: `不符合格式 ${schema.pattern}（实际 "${data}"）` });
      }
    }
    if (schema.format === 'date-time' && !DATE_TIME_RE.test(data)) {
      errors.push({ path: ptr, message: `必须是 ISO 8601 带时区的时间（实际 "${data}"）` });
    }
  }

  // ---- array ----
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push({ path: ptr, message: `元素不得少于 ${schema.minItems} 个（实际 ${data.length}）` });
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push({ path: ptr, message: `元素不得超过 ${schema.maxItems} 个（实际 ${data.length}）` });
    }
    if (schema.uniqueItems === true) {
      const seen = new Set();
      data.forEach((v, i) => {
        const k = stable(v);
        if (seen.has(k)) errors.push({ path: `${ptr}[${i}]`, message: '元素重复（uniqueItems）' });
        seen.add(k);
      });
    }
    if (schema.items !== undefined) {
      data.forEach((v, i) => validateNode(schema.items, v, `${ptr}[${i}]`, errors));
    }
  }

  // ---- object ----
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) {
          errors.push({ path: ptr, message: `缺少必填字段 "${key}"` });
        }
      }
    }
    const props = schema.properties || {};
    const patterns = schema.patternProperties || null;
    for (const key of Object.keys(data)) {
      if (Object.prototype.hasOwnProperty.call(props, key)) {
        validateNode(props[key], data[key], `${ptr}.${key}`, errors);
        continue;
      }
      let matchedPattern = false;
      if (patterns) {
        for (const p of Object.keys(patterns)) {
          if (new RegExp(p).test(key)) {
            validateNode(patterns[p], data[key], `${ptr}.${key}`, errors);
            matchedPattern = true;
          }
        }
      }
      if (matchedPattern) continue;
      if (schema.additionalProperties === false) {
        errors.push({ path: `${ptr}.${key}`, message: '不允许的额外字段' });
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        validateNode(schema.additionalProperties, data[key], `${ptr}.${key}`, errors);
      }
    }
  }

  // ---- combinators ----
  if (Array.isArray(schema.allOf)) {
    schema.allOf.forEach((s) => validateNode(s, data, ptr, errors));
  }
  if (Array.isArray(schema.anyOf)) {
    const ok = schema.anyOf.some((s) => {
      const e = [];
      validateNode(s, data, ptr, e);
      return e.length === 0;
    });
    if (!ok) errors.push({ path: ptr, message: 'anyOf 的所有分支均不匹配' });
  }
  if (Array.isArray(schema.oneOf)) {
    const n = schema.oneOf.filter((s) => {
      const e = [];
      validateNode(s, data, ptr, e);
      return e.length === 0;
    }).length;
    if (n !== 1) {
      errors.push({ path: ptr, message: `oneOf 要求恰好匹配 1 个分支，实际匹配 ${n} 个` });
    }
  }
  if (schema.not !== undefined) {
    const e = [];
    validateNode(schema.not, data, ptr, e);
    if (e.length === 0) errors.push({ path: ptr, message: '命中 not 排除项' });
  }
}

/**
 * @param {object} schema JSON Schema（子集）
 * @param {any} data 待校验数据
 * @returns {{valid: boolean, errors: {path: string, message: string}[]}}
 */
function validateAgainst(schema, data) {
  const errors = [];
  validateNode(schema, data, '$', errors);
  return { valid: errors.length === 0, errors };
}

module.exports = { validateAgainst, jsonType, DATE_TIME_RE };
