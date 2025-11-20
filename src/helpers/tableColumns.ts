type ColumnOptions = {
  label: string,
  field?: string,
  align?: string,
  format?:any,
  sortable?: boolean
} | null

export const genColumns = (options: ColumnOptions[]): any[] => {
  return options.filter(c => !!c).map(({ label, field, align, sortable }) => {
    return {
      label,
      field,
      name: field,
      sortable: sortable !== undefined ? sortable : !!field,
      align: align || 'left',
    }
  })
}