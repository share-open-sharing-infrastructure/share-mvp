<script>
import Uploadimg from './Uploadimg.svelte'

let item_name = '';
let item_description = '';
let item_image = null;
let items = [];

let uploadImgComponent;


function handleImageSelected(event) {
    item_image = event.detail.imageDataUrl;
  }




function addItem() {
    if (item_name && item_description && item_image) {
        items = [...items, { item_image, item_name, item_description,  }];
        item_name = '';
        item_description = '';
        item_image = null;
        uploadImgComponent.reset(); 
    }
}

</script>

<h1>Gegenstände</h1>


<h2> Neuen Gegenstand hinzuƒügen</h2>

<Uploadimg on:imageSelected={handleImageSelected}  bind:this={uploadImgComponent}/>

<p><input type="text" bind:value={item_name} placeholder="Name des Gegenstands" />   </p>
<p><input type="text" bind:value={item_description} placeholder="Beschreibung des Gegenstands" /> </p>


<p><button onclick={addItem}>Gegenstand hinzufügen</button></p>


<h2> Liste </h2>

{#each items.reverse() as item}
    <div>
        <p><img src={item.item_image} alt=""></p>
        <h3>{item.item_name}</h3>
        <p>{item.item_description}</p>
    </div>
{/each}



