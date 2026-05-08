export function formatMoney(value: number): string {
  return `¥${value.toFixed(2)}`;
}

export function formatWeight(value: number): string {
  return `${Number(value.toFixed(1))}斤`;
}

export function amountToChinese(amount: number): string {
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '万', '亿'];

  if (amount === 0) return '零元整';

  const str = amount.toFixed(2);
  const [intPart, decPart] = str.split('.');
  const jiao = parseInt(decPart[0]) || 0;
  const fen = parseInt(decPart[1]) || 0;

  let result = '';
  const intNum = parseInt(intPart);

  if (intNum > 0) {
    const intStr = intNum.toString();
    const groups: string[] = [];
    for (let i = intStr.length; i > 0; i -= 4) {
      groups.unshift(intStr.slice(Math.max(0, i - 4), i));
    }

    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];
      let groupStr = '';
      let hasNonZero = false;
      let prevZero = false;

      for (let i = 0; i < group.length; i++) {
        const d = parseInt(group[i]);
        const unitIndex = group.length - 1 - i;

        if (d === 0) {
          prevZero = true;
        } else {
          if (prevZero) groupStr += '零';
          groupStr += digits[d] + units[unitIndex];
          hasNonZero = true;
          prevZero = false;
        }
      }

      if (groupStr) {
        result += groupStr + bigUnits[groups.length - 1 - g];
      }
    }
    result += '元';
  }

  if (jiao === 0 && fen === 0) {
    result += '整';
  } else {
    if (jiao > 0) {
      result += digits[jiao] + '角';
    } else if (intNum > 0) {
      result += '零';
    }
    if (fen > 0) {
      result += digits[fen] + '分';
    }
  }

  return result;
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}
