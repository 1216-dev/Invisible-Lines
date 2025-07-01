import { NextResponse } from "next/server"

export async function GET() {
  // Generate sample data for US counties
  const sampleData = generateSampleData()

  return NextResponse.json(sampleData)
}

function generateSampleData() {
  // Create sample data for US counties
  const counties = [
    { FIPS: "01001", County: "Autauga County", State: "Alabama" },
    { FIPS: "01003", County: "Baldwin County", State: "Alabama" },
    { FIPS: "01005", County: "Barbour County", State: "Alabama" },
    { FIPS: "06001", County: "Alameda County", State: "California" },
    { FIPS: "06003", County: "Alpine County", State: "California" },
    { FIPS: "06005", County: "Amador County", State: "California" },
    { FIPS: "12001", County: "Alachua County", State: "Florida" },
    { FIPS: "12003", County: "Baker County", State: "Florida" },
    { FIPS: "12005", County: "Bay County", State: "Florida" },
    { FIPS: "36001", County: "Albany County", State: "New York" },
    { FIPS: "36003", County: "Allegany County", State: "New York" },
    { FIPS: "36005", County: "Bronx County", State: "New York" },
    { FIPS: "48001", County: "Anderson County", State: "Texas" },
    { FIPS: "48003", County: "Andrews County", State: "Texas" },
    { FIPS: "48005", County: "Angelina County", State: "Texas" },
    // Add more counties as needed
  ]

  // Generate random health metrics for each county
  return counties.map((county) => {
    return {
      ...county,
      Obesity: Math.random() * 40 + 10,
      "Food Insecurity": Math.random() * 25 + 5,
      "Physical Inactivity": Math.random() * 35 + 15,
      "Poor Health": Math.random() * 30 + 10,
      "Median Income": Math.random() * 80000 + 30000,
      Poverty: Math.random() * 30 + 5,
      Population: Math.floor(Math.random() * 1000000 + 10000),
    }
  })
}
