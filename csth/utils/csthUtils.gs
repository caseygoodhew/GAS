const csthUtilsDebug = () => {
  execCSTH();
}

const sumProp = (arr, prop) => {
  return arr.reduce((s, item) => {
    const value = item[prop];
    if (typeof value === 'number') {
      return s + value;
    }
    return s;
  }, 0)
}

const sumProps = (arr, props) => {
  return props.reduce((sum, prop) => {
    return sum + sumProp(arr, prop);
  }, 0);
}