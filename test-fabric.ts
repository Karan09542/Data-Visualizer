import * as fabric from 'fabric';

class CustomFilter extends fabric.filters.BaseFilter {
  static type = 'CustomFilter';
  getFragmentSource() { return ''; }
}
console.log(Object.getOwnPropertyNames(fabric.filters.BaseFilter.prototype));
