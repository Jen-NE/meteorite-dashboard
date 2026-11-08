import pandas as pd
import numpy as np
import re
import warnings

# --- IMPORTANT ---
# This script requires the 'reverse-geocoder' library.
# Please install it in your environment before running:
#
# pip install reverse-geocoder
#
# After installation, you can run this script.
try:
    import reverse_geocoder as rg
except ImportError:
    print("Error: The 'reverse-geocoder' library is not installed.")
    print("Please install it using: pip install reverse-geocoder")
    exit()

# Suppress specific warnings if necessary
warnings.filterwarnings('ignore', category=FutureWarning)

def get_general_class(recclass):
    '''
    Classifies a meteorite based on its 'recclass' string into
    general categories: Chondrite, Achondrite, Stony-Iron, Iron, or Unknown.
    '''
    if not isinstance(recclass, str):
        return 'Unknown'
    
    recclass = recclass.strip()
    
    # Iron
    if re.search(r'^Iron', recclass, re.I) or \
       re.match(r'^(I|II|III|IV)[A-F]{1,2}', recclass):
        return 'superior-Iron'
        
    # Stony-Iron
    if re.search(r'^Pallasite', recclass, re.I) or \
       re.search(r'^Mesosiderite', recclass, re.I):
        return 'Stony-Iron'
        
    # Stony: Chondrites
    # Common classes (H, L, LL, E, C, R, K)
    if re.match(r'^(H|L|LL|E|C|R|K)', recclass):
        return 'Chondrite'
    # Other specific chondrite classes
    if re.search(r'^(CB|CH|CR|CI|CM|CO|CV|CK)', recclass):
        return 'Chondrite'
        
    # Stony: Achondrites
    # HED group
    if re.search(r'^(Eucrite|Howardite|Diogenite)', recclass, re.I):
        return 'Achondrite'
    # Other achondrites
    if re.search(r'^(Acapulcoite|Lodranite|Angrite|Aubrite|Ureilite|Brachinite|Lunar|Martian|Winonaite)', recclass, re.I):
        return 'Achondrite'
        
    # Other specific cases
    if recclass == 'Achondrite-ung':
        return 'Achondrite'
    if recclass == 'Chondrite-ung':
        return 'Chondrite'
    
    # Default
    return 'Unknown'

def process_meteorite_data(input_csv, output_csv):
    '''
    Loads meteorite data, adds 'general_class' and 'country_code' columns,
    and saves the processed data to a new CSV file.
    '''
    try:
        # Load the dataframe
        df = pd.read_csv(input_csv)
        print(f"Loaded '{input_csv}'. Total rows: {len(df)}")
        
        # --- 1. Filter out rows with missing critical data ---
        print("\nFiltering out incomplete entries...")
        initial_count = len(df)
        
        # Remove rows missing coordinates
        df = df.dropna(subset=['reclat', 'reclong'])
        print(f"  After removing missing coordinates: {len(df)} rows ({initial_count - len(df)} removed)")
        
        # Remove rows missing mass
        df = df[df['mass (g)'].notna() & (df['mass (g)'] > 0)]
        print(f"  After removing missing/zero mass: {len(df)} rows ({initial_count - len(df)} removed total)")
        
        # Remove rows missing year
        df = df[df['year'].notna()]
        print(f"  After removing missing year: {len(df)} rows ({initial_count - len(df)} removed total)")
        
        # Remove rows missing recclass
        df = df.dropna(subset=['recclass'])
        print(f"  After removing missing recclass: {len(df)} rows ({initial_count - len(df)} removed total)")
        
        # Reset index after filtering
        df = df.reset_index(drop=True)
        print(f"\nTotal entries filtered out: {initial_count - len(df)}")
        print(f"Remaining valid entries: {len(df)}")
        
        # --- 2. Add 'general class' column ---
        df['general_class'] = df['recclass'].apply(get_general_class)
        print("\nAdded 'general_class' column.")
        
        # --- 3. Add 'country' (country code) column ---
        df['country_code'] = np.nan
        
        # All rows should have valid coordinates now (filtered above)
        valid_indices = df.index
        
        # Ensure coordinates are in a list of tuples format
        coordinates = list(zip(df['reclat'], df['reclong']))
        
        if coordinates:
            # Perform reverse geocoding
            print(f"\nPerforming reverse geocoding on {len(coordinates)} coordinates...")
            # This is a fast, offline reverse geocoder
            results = rg.search(coordinates) 
            
            # Extract country codes ('cc')
            country_codes = [res['cc'] for res in results]
            
            # Map results back to the DataFrame
            df.loc[valid_indices, 'country_code'] = country_codes
            print("Reverse geocoding complete.")
        else:
            print("No valid coordinates found to geocode.")
            
        # --- 4. Save the new DataFrame ---
        df.to_csv(output_csv, index=False)
        print(f"Successfully processed data and saved to '{output_csv}'.")
        
        # --- 4. Display summary ---
        print("\n--- Summary of Processed Data ---")
        print(f"Total rows: {len(df)}")
        print("\nHead of processed data:")
        print(df.head())
        print("\nValue counts for 'general_class':")
        print(df['general_class'].value_counts())
        print("\nTop 20 countries (by code):")
        print(df['country_code'].value_counts().head(20))
        
    except FileNotFoundError:
        print(f"Error: The file '{input_csv}' was not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    # Define file names
    INPUT_FILE = "Meteorite_Landings.csv"
    OUTPUT_FILE = "javascript-dashboard/Meteorite_Landings_Processed.csv"
    
    # Run the processing function
    process_meteorite_data(INPUT_FILE, OUTPUT_FILE)