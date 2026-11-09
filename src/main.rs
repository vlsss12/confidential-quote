use primus_ntt::U64NttTable as Table;
use primus_tfhe_glwe_ntt::{TfheContext, experimental};
use rand::{SeedableRng, rngs::StdRng};
use std::{env, error::Error};

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<_> = env::args().skip(1).collect();
    let [quantity, tier] = args.as_slice() else {
        return Err("Usage: confidential-quote QUANTITY LOYALTY_LEVEL".into());
    };
    let quantity: u64 = quantity.parse()?;
    let tier: u64 = tier.parse()?;
    if !(1..=3).contains(&quantity) || tier > 3 {
        return Err("Use a quantity from 1 to 3 and a loyalty level from 0 to 3.".into());
    }

    let context = TfheContext::<u64, Table>::try_from_pbs_config(experimental::CLASSIC_PBS_U64)?;
    let mut rng = StdRng::try_from_rng(&mut rand::rngs::SysRng)?;
    let (client_key, evaluation_key) = context.try_generate_keys(&mut rng)?;
    let secret = client_key.external_lwe_secret_key();
    let encryptor = context.encryptor(secret)?;
    let mut encrypted_quantity = context.allocate_lwe_ciphertext();
    let mut encrypted_tier = context.allocate_lwe_ciphertext();
    encryptor.encrypt_padded_to(quantity - 1, encrypted_quantity.as_mut_view(), &mut rng)?;
    encryptor.encrypt_padded_to(tier, encrypted_tier.as_mut_view(), &mut rng)?;

    // Pack the two ciphertexts into one lookup index in 0..=11.
    let modulus = context.parameters().external_modulus();
    let mut packed = context.allocate_lwe_ciphertext();
    encrypted_quantity.mul_scalar_to(4, &mut packed, modulus);
    packed.add_assign(&encrypted_tier, modulus);

    // Prices occupy 3..=15, within the padded message domain.
    let policy = context.pbs_lookup_table_compiler()?.compile_fn(|index| {
        (5 * (1 + (index / 4).min(2)) - 2 * usize::from(index % 4 >= 2)) as u64
    })?;
    let mut encrypted_price = context.allocate_lwe_ciphertext();
    context.evaluator(&evaluation_key)?.apply_lookup_table_to(
        packed.as_view(),
        &policy,
        encrypted_price.as_mut_view(),
    );

    let price = context
        .pbs_decryptor(secret)?
        .decrypt(encrypted_price.as_view())?;
    if !(3..=15).contains(&price) {
        return Err("Decrypted price is outside the policy range.".into());
    }
    println!("{price}");
    Ok(())
}
