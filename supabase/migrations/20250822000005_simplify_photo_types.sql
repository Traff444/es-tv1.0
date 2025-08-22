-- Упрощение системы фото - только 2 фото: "до" и "после"
-- Обновляем типы задач для упрощенной системы

-- Обновляем типы задач для упрощенной системы
UPDATE task_types 
SET 
  photo_min = 2,
  default_checklist = '["Ракурс/общий вид", "Уровень/вертикаль/маркировка", "Чистота места"]'::jsonb
WHERE slug IN (
  'generic_low_risk',
  'generic_medium_risk', 
  'generic_high_risk',
  'outlet_install',
  'switch_install',
  'light_point_install',
  'cable_chase',
  'cable_pull',
  'junction_box_splice',
  'panel_board_assembly',
  'outlet_rework',
  'switch_rework'
);

-- Устанавливаем requires_before_photos = true для всех типов задач
UPDATE task_types 
SET requires_before_photos = true
WHERE slug IN (
  'generic_medium_risk',
  'generic_high_risk',
  'cable_chase',
  'cable_pull',
  'junction_box_splice',
  'outlet_rework',
  'switch_rework'
);
