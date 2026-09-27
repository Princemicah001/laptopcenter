# ============================================
# AI Water & Power Tracker
# Major Improvement: Weighted Attribution
# ============================================

print("=== AI Water & Power Tracker ===")
print("Zetu Zetu team we have the Weighted Attribution Prototype\n")

# ============================================
# EASY TO CHANGE SECTION
# ============================================

# Total resources used today
total_water = 24000      # liters
total_power = 720000     # kWh

# Jobs with their relative size (weight)
# Higher weight = more resource-intensive job
jobs = {
    "Training Job A - Large Language Model": 4.0,
    "Inference Job B - Chatbot Service": 1.5,
    "Training Job C - Image Generation": 3.0,
    "Batch Job D - Data Processing": 1.0,
    "Fine-tuning Job E - Customer Model": 2.5,
    "Learning from Prince Job F- Genius Model": 3.5,
    " Dancing Job G- Gloria Kuslide model": 4.3,
    "Attention Job H- Naomi Attentive model": 2.1,
    " Joker Job I- Max Never Serious model": 1.2,
    "Etc Job J- Ran out of more model ideas model": 4.6
}

# ============================================
# CALCULATION SECTION
# ============================================

# Calculate total weight
total_weight = sum(jobs.values())

print("=" * 65)
print("                 WEIGHTED ATTRIBUTION RESULTS")
print("=" * 65)
print(f"Total Water Used     : {total_water:,} liters")
print(f"Total Power Used     : {total_power:,} kWh")
print(f"Number of AI Jobs    : {len(jobs)}")
print(f"Total Weight Units   : {total_weight}")
print("=" * 65)

print("\nDetailed Breakdown (Weighted):")
print("-" * 65)

for job_name, weight in jobs.items():
    # Calculate share based on weight
    share = weight / total_weight
    water_for_job = total_water * share
    power_for_job = total_power * share

    print(f"• {job_name}")
    print(f"  Weight: {weight}")
    print(f"  → Water attributed : {water_for_job:,.1f} liters")
    print(f"  → Power attributed : {power_for_job:,.1f} kWh")
    print()

print("=" * 65)
print("HEY PRINCE CAN YOU TAKE IT FROM HERE")
print("-" * 65)
print("so the below are the improvements I have made prince. ")
print("Instead of giving every job the same amount,")
print("this version gives more resources to heavier jobs.")
print("This is closer to how real AI workloads behave.")
print("However Prince this is just the base functioning. ")
print("=" * 65)
print("Major improvement completed successfully.")