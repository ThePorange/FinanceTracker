fetch('http://localhost:3000/sources/setup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: "Test Source",
    config: {},
    mappings: [
      {
        sourcefile_fieldname: "Amount",
        staging_tablename: "staging_test_source",
        staging_table_fieldname: "amount",
        datatype: "real",
        transaction_table_fieldname: "base_amount",
        default_value: "",
        derived_field: "n",
        unique_records: "n"
      }
    ]
  })
}).then(r => r.text().then(data => console.log(r.status, data)))
