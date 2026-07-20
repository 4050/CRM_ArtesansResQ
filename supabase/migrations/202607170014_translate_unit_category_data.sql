-- consumables.unit/category были свободным текстом на русском ('шт', 'СИЗ', ...).
-- Переводим в языково-нейтральные коды, чтобы приложение могло показывать
-- перевод по словарю (EN/UK) вместо жёстко зашитого русского значения.
-- Любое значение вне известного набора (не заведённое через форму, а
-- вписанное вручную в БД) не трогаем — не с чем сопоставлять.

update public.consumables
set unit = case unit
  when 'шт' then 'pcs'
  when 'пар' then 'pair'
  when 'мл' then 'ml'
  when 'л' then 'l'
  when 'г' then 'g'
  when 'кг' then 'kg'
  when 'упак' then 'pack'
  when 'фл' then 'vial'
  when 'амп' then 'amp'
  else unit
end;

update public.consumables
set category = case category
  when 'СИЗ' then 'ppe'
  when 'Перевязка' then 'dressings'
  when 'Инструменты' then 'instruments'
  when 'Растворы' then 'solutions'
  when 'Медикаменты' then 'medications'
  when 'Прочее' then 'other'
  else category
end;

alter table public.consumables alter column unit set default 'pcs';
alter table public.consumables alter column category set default 'other';
