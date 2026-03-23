INSERT INTO work_groups (group_name, name, category) 
SELECT 'General Service', 'General Service', 'Standard'
WHERE NOT EXISTS (SELECT 1 FROM work_groups WHERE group_name = 'General Service');

INSERT INTO work_groups (group_name, name, category) 
SELECT 'Engine Repair', 'Engine Repair', 'Mechanical'
WHERE NOT EXISTS (SELECT 1 FROM work_groups WHERE group_name = 'Engine Repair');

INSERT INTO vehicle_makes (make_name, name, vehicle_type, status)
SELECT 'Maruti Suzuki', 'Maruti Suzuki', 'Four Wheeler', 'Active'
WHERE NOT EXISTS (SELECT 1 FROM vehicle_makes WHERE make_name = 'Maruti Suzuki');

INSERT INTO vehicle_makes (make_name, name, vehicle_type, status)
SELECT 'Hyundai', 'Hyundai', 'Four Wheeler', 'Active'
WHERE NOT EXISTS (SELECT 1 FROM vehicle_makes WHERE make_name = 'Hyundai');
