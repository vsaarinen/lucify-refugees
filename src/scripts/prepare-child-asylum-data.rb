#!/usr/bin/env ruby

require 'csv'
require 'json'

Dir.mkdir('./temp') unless File.exists?('./temp')
Dir.mkdir('./temp/data-assets') unless File.exists?('./temp/data-assets')

OUTPUT_FILE = './temp/data-assets/asylum.json'
INPUT_FILE = './data/child_asylum_seekers_finland.csv'

month_data = []

File.delete(OUTPUT_FILE) if File.exists?(OUTPUT_FILE)

CSV.foreach(INPUT_FILE, {headers: true, col_sep: ';'}) do |row|
  origin_country_code = row[0]
  (1..59).each do |n| # We have data from Jan 2011 to Nov 2015 = 59 months
    count =
      if row[n].nil?
        0
      else
        row[n].to_i
      end
    month_data << {
      oc: origin_country_code,
      ac: "FIN",
      month: (n - 1) % 12 + 1, # Jan = 1
      year: 2011 + (n-1)/12,
      count: count
    }
  end
end

File.open(OUTPUT_FILE, 'w') { |f| f.write(month_data.to_json) }
