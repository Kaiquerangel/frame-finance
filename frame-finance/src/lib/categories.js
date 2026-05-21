import { supabase } from "./supabase";

const DEFAULT_CATS = {
  receita: ["Salário","Freelance","Investimentos","Aluguel recebido","Dividendos","Presente","Outros"],
  despesa: ["Moradia","Alimentação","Transporte","Saúde","Lazer","Educação","Vestuário","Assinaturas","Eletrônicos","Outros"],
};

export async function loadCategories(userId) {
  const { data } = await supabase.from("categories").select("*").eq("user_id", userId);
  const merged = {
    receita: [...DEFAULT_CATS.receita],
    despesa: [...DEFAULT_CATS.despesa],
  };
  (data || []).forEach(c => {
    if (!merged[c.type].includes(c.name)) merged[c.type].push(c.name);
  });
  return merged;
}

export { DEFAULT_CATS };
