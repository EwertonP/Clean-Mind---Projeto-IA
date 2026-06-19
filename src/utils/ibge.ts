export interface IBGEState {
  id: number;
  sigla: string;
  nome: string;
}

export interface IBGECity {
  id: number;
  nome: string;
}

export const getStates = async (): Promise<IBGEState[]> => {
  try {
    const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch ibge states', err);
    return [];
  }
};

export const getCities = async (stateSigla: string): Promise<IBGECity[]> => {
  try {
    const states = await getStates();
    const state = states.find(s => s.sigla === stateSigla);
    if (!state) return [];
    
    const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state.id}/municipios?orderBy=nome`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch ibge cities', err);
    return [];
  }
};

export const fetchAddressByCep = async (cep: string) => {
  try {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return null;
    const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return {
      street: data.logradouro,
      neighborhood: data.bairro,
      city: data.localidade,
      state: data.uf,
    };
  } catch (err) {
    console.error('error fetching cep', err);
    return null;
  }
};
