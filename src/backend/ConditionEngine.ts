/**
 * ConditionEngine.ts
 * Evaluates per-row conditional rules defined in a Scheduler.
 */

const ConditionEngine = (() => {
  type Operator = 'equals'|'notEquals'|'contains'|'greaterThan'|'lessThan'|'isDate'|'isChecked'|'isNotEmpty';

  interface Rule {
    column: string;
    operator: Operator;
    value: string;
    logicOperator?: 'AND'|'OR';
  }

  function evaluateRow(row: Record<string, any>, rules: Rule[]): boolean {
    if (!rules || rules.length === 0) return true;

    let result = evalSingle(row, rules[0]);
    for (let i = 1; i < rules.length; i++) {
      const rule = rules[i];
      const ruleResult = evalSingle(row, rule);
      if ((rule.logicOperator ?? 'AND') === 'OR') {
        result = result || ruleResult;
      } else {
        result = result && ruleResult;
      }
    }
    return result;
  }

  function evalSingle(row: Record<string, any>, rule: Rule): boolean {
    const cellVal = String(row[rule.column] ?? '').trim().toLowerCase();
    const ruleVal = rule.value.trim().toLowerCase();

    switch (rule.operator) {
      case 'equals':       return cellVal === ruleVal;
      case 'notEquals':    return cellVal !== ruleVal;
      case 'contains':     return cellVal.includes(ruleVal);
      case 'greaterThan':  return parseFloat(cellVal) > parseFloat(ruleVal);
      case 'lessThan':     return parseFloat(cellVal) < parseFloat(ruleVal);
      case 'isNotEmpty':   return cellVal !== '';
      case 'isChecked':    return cellVal === 'true' || cellVal === '1' || cellVal === 'yes' || cellVal === '✓';
      case 'isDate': {
        const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
        return cellVal.includes(today);
      }
      default: return true;
    }
  }

  return { evaluateRow };
})();
